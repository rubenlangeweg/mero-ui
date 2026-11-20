import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const styleCache = join(tmpdir(), 'mero-edit-comparison-5.8.1-3.2.7');
const sources = [
  {id:'daisyui', name:'daisyui@5.8.1', archive:'daisyui-5.8.1.tgz', file:'package/daisyui.css', sha256:'0e737f52e0c583d1864c2a4ffdb8a3127cbc72f4ad6c1eacf127d7b8e9b31902'},
  {id:'heroui', name:'@heroui/styles@3.2.7', archive:'heroui-styles-3.2.7.tgz', file:'package/dist/heroui.min.css', sha256:'6c29446c65a517b65b0be08ed875713dfc9267a7da8e5fcda81cbb5bea1e8f66'},
];

async function install(fromDirectory) {
  const directory = fromDirectory ?? await mkdtemp(join(tmpdir(),'mero-upstream-css-'));
  await mkdir(styleCache,{recursive:true});
  for (const source of sources) {
    if (!fromDirectory) execFileSync('npm',['pack',source.name,'--ignore-scripts','--silent','--pack-destination',directory],{stdio:'inherit'});
    const archive = join(directory,source.archive);
    const extract = file => execFileSync('tar',['xOzf',archive,file],{maxBuffer:4_000_000});
    const css = extract(source.file);
    if (createHash('sha256').update(css).digest('hex') !== source.sha256) throw new Error(`Unexpected stylesheet for ${source.name}`);
    await writeFile(join(styleCache,source.id+'.css'),css);
    await writeFile(join(styleCache,source.id+'-LICENSE.txt'),extract('package/LICENSE'));
    console.log(`${source.name}: ${css.length} bytes, SHA-256 verified`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await install(process.argv[2]);
