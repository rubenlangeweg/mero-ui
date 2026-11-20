import { field, item, section } from "./helpers.mjs"

export const groups = [
  section("Colors", [
    item("color-area", "Color Area", "Open a browser-managed color surface and submit the selected color.",
      field("demo-color-area", "Accent color", 'name="accent" value="#b9a5ff"', { type: "color" }),
      "The platform owns the color area and keyboard behavior. Its available controls depend on the browser."),
    item("color-field", "Color Field", "Enter a six-digit hex value directly in a text field.",
      field("demo-color-field", "Hex color", 'name="color" pattern="#[0-9a-fA-F]{6}" maxlength="7" value="#b9a5ff"', { hint: "Use # followed by six hexadecimal digits." }),
      "Validate the format again when the form reaches the server."),
    item("color-picker", "Color Picker", "Choose a color using the native picker UI.",
      field("demo-color-picker", "Theme accent", 'name="color" value="#85b8ff"', { type: "color" })),
    item("color-slider", "Color Slider", "Adjust a hue along the color spectrum.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-hue">Hue</label>
        <input class="mero-slider mero-color-slider" id="demo-hue" name="hue"
          type="range" min="0" max="359" step="1" value="255" aria-describedby="demo-hue-help">
        <p class="mero-description" id="demo-hue-help">0° to 359°</p>
      </div>`,
      "The submitted value is the hue. Combine it with saturation and lightness in your app."),
    item("color-swatch", "Color Swatch", "Show a color with its human-readable label.", `
      <div class="mero-row">
        <span class="mero-swatch" aria-hidden="true"
          style="display:inline-block;width:2rem;height:2rem;border-radius:0.45rem;background:#b9a5ff"></span>
        <span>Mero violet <code>#B9A5FF</code></span>
      </div>`),
  ]),
]
