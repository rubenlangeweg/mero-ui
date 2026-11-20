import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});
async function serve(t) {
  const server = createApp();
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return "http://127.0.0.1:"+server.address().port;
}
test("communication examples retain replies per session and accept regular HTML form posts", async t => {
  const base = await serve(t);
  const page = await fetch(base+"/layouts/mail");
  const cookie = page.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("relay_comm="));
  for (let i=0;i<2;i++) {
    const reply = await fetch(base+"/demo/layouts/mail/reply", {
      method:"POST",headers:{Cookie:cookie},redirect:"manual",
      body:new URLSearchParams({thread:"proofs",nonce:"same-submit",message:"I agree on the <stock>."}),
    });
    assert.equal(reply.status,303);
    assert.equal(reply.headers.get("location"),"/layouts/mail?folder=inbox&thread=proofs");
  }
  const saved = await (await fetch(base+"/layouts/mail?thread=proofs", {headers:{Cookie:cookie}})).text();
  assert.equal((saved.match(/<p>I agree on the &lt;stock&gt;\.<\/p>/g)||[]).length,1);
  const revised = await fetch(base+"/demo/layouts/mail/reply", {
    method:"POST",headers:{Cookie:cookie,"HX-Request":"true"},
    body:new URLSearchParams({thread:"proofs",nonce:"same-submit",message:"A revised reply."}),
  });
  assert.equal(revised.status,422);
  const correctionForm=await revised.text();
  assert.match(correctionForm, /The earlier message was sent/);
  assert.match(correctionForm, /aria-invalid="true"[^>]*>A revised reply\.<\/textarea>/);
  const fresh = await (await fetch(base+"/layouts/mail?thread=proofs")).text();
  assert.doesNotMatch(fresh,/I agree on the/);
  const invalid = await fetch(base+"/demo/layouts/chat/send", {
    method:"POST",headers:{Cookie:cookie,"HX-Request":"true"},body:new URLSearchParams({room:"dispatch",message:" "}),
  });
  assert.equal(invalid.status,422);
  assert.match(await invalid.text(),/aria-invalid="true"/);
  const plainInvalid = await fetch(base+"/demo/layouts/chat/send", {
    method:"POST",headers:{Cookie:cookie},body:new URLSearchParams({room:"dispatch",message:" "}),
  });
  assert.equal(plainInvalid.status,422);
  const correction = await plainInvalid.text();
  assert.match(correction, /<!doctype html>/i);
  assert.match(correction, /name="room" value="dispatch"/);
  assert.match(correction, /id="chat-message"[^>]+aria-invalid="true"[^>]*> <\/textarea>/);
});

test("mail and chat change threads and update the correct narrow-screen panel", {
  skip:!playwright && "Install Playwright to run the browser regression",
}, async t => {
  const base = await serve(t);
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({executablePath:engine==="chromium"?browserConfig.chromeExecutable:undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:360,height:800}});
  page.setDefaultTimeout(6000);
  await page.goto(base+"/layouts/mail");
  const frame = page.locator('[data-communication="mail"]');
  await frame.getByRole("link",{name:/Julian Park/}).click();
  await frame.getByRole("heading",{name:"Material library update"}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("thread"),"materials");
  await frame.getByLabel("Reply to Julian").fill("Meet me at the sample table.");
  await frame.getByRole("button",{name:"Send reply"}).click();
  await frame.getByRole("status").filter({hasText:"Reply sent"}).waitFor();
  assert.ok(await frame.locator(".comm-reply").getByText("Meet me at the sample table.").isVisible());
  await frame.getByRole("button",{name:"Archive",exact:true}).click();
  await frame.getByRole("link",{name:/Archive/}).click();
  await frame.getByRole("link",{name:/Julian Park/}).click();
  await frame.getByRole("button",{name:"Move to inbox"}).click();
  await frame.getByRole("status").filter({hasText:"Message moved to inbox"}).waitFor();
  await page.goto(base+"/layouts/chat");
  const chat=page.locator('[data-communication="chat"]');
  await chat.getByRole("link",{name:"Conversations",exact:true}).click();
  await chat.getByRole("link",{name:"dispatch",exact:true}).click();
  await chat.getByRole("heading",{name:"dispatch",exact:true}).waitFor();
  await chat.getByRole("textbox",{name:"Message #dispatch"}).fill("All items are packed.");
  await chat.getByRole("button",{name:"Send",exact:true}).click();
  await chat.locator(".comm-feed").getByText("All items are packed.").waitFor();
  await page.reload();
  assert.ok(await chat.locator(".comm-feed").getByText("All items are packed.").isVisible());
  await page.setViewportSize({width:1280,height:850});
  await chat.getByRole("link",{name:"Mara Lind"}).click();
  await chat.getByRole("heading",{name:"Mara Lind",exact:true}).waitFor();
  assert.equal(await chat.locator(".comm-feed").getByText("All items are packed.").count(),0);
  await page.setViewportSize({width:320,height:790});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test("mail and chat keep each conversation's draft until its submitted text is accepted", {
  skip:!playwright && "Install Playwright to run the browser regression",
}, async t => {
  const base = await serve(t);
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({executablePath:engine==="chromium"?browserConfig.chromeExecutable:undefined});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:1280,height:850}});
  page.setDefaultTimeout(4000);

  await page.goto(base + "/layouts/mail?thread=proofs");
  const mail = page.locator('[data-communication="mail"]');
  await mail.getByLabel("Reply to Mara").fill("Keep the paper uncoated.");
  await mail.getByRole("link", {name:/Julian Park/}).click();
  assert.equal(await mail.getByLabel("Reply to Julian").inputValue(), "");
  assert.ok(await mail.getByRole("link", {name:/Mara Lind.*Draft/}).isVisible());
  await page.goBack();
  await page.waitForFunction(() => document.querySelector("#mail-reply")?.value === "Keep the paper uncoated.");
  await page.reload();
  assert.equal(await mail.getByLabel("Reply to Mara").inputValue(), "Keep the paper uncoated.");
  await mail.getByRole("button", {name:"Send reply"}).click();
  await mail.getByRole("status").getByText("Reply sent.").waitFor();
  assert.equal(await mail.getByLabel("Reply to Mara").inputValue(), "");
  assert.equal(await mail.getByRole("link", {name:/Mara Lind.*Draft/}).count(), 0);

  await page.setViewportSize({width:360,height:780});
  await page.goto(base + "/layouts/chat?room=dispatch");
  const chat = page.locator('[data-communication="chat"]');
  const composer = chat.getByLabel("Message #dispatch");
  await composer.fill("Packed and ready.");
  await chat.getByRole("link", {name:"Conversations"}).click();
  await chat.getByRole("link", {name:/dispatch.*Draft/}).click();
  assert.equal(await composer.inputValue(), "Packed and ready.");
  // A second thought typed while the first message is in flight is still a draft.
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/demo/layouts/chat/send", async route => {
    await pending;
    await route.continue();
  }, {times:1});
  const sending = page.waitForRequest("**/demo/layouts/chat/send");
  await chat.getByRole("button", {name:"Send",exact:true}).click();
  await sending;
  await composer.fill("The second batch leaves tomorrow.");
  release();
  await chat.locator(".comm-feed").getByText("Packed and ready.").waitFor();
  assert.equal(await composer.inputValue(), "The second batch leaves tomorrow.");
  await page.reload();
  assert.equal(await composer.inputValue(), "The second batch leaves tomorrow.");
  await page.route("**/demo/layouts/chat/send", route => route.abort(), {times:1});
  await chat.getByRole("button", {name:"Send",exact:true}).click();
  await chat.getByRole("alert").filter({hasText:/could not be reached/}).waitFor();
  await page.reload();
  assert.equal(await composer.inputValue(), "The second batch leaves tomorrow.");
  await page.context().clearCookies();
  await page.reload();
  assert.equal(await composer.inputValue(), "");
});
