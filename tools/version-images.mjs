// Edit IMAGE_VERSION in main.js, then run this command before shipping.
import {readFileSync,writeFileSync} from 'node:fs';
const js=readFileSync('main.js','utf8');
const version=js.match(/const IMAGE_VERSION = '([\w.-]+)'/)?.[1];
if(!version)throw new Error('Missing IMAGE_VERSION in main.js');
const check=process.argv.includes('--check');
for(const file of ['index.html','style.css']){
  const original=readFileSync(file,'utf8');
  const updated=original.replace(/(images\/[^\s"'()]+?\.(?:webp|png|jpg|jpeg|svg|avif))(?:\?v=[\w.-]+)?/g,`$1?v=${version}`);
  if(original!==updated){
    if(check)throw new Error(`${file} has unversioned or stale image URLs`);
    writeFileSync(file,updated);
  }
}
const imagePaths=[...js.matchAll(/images\/[^\n`]*?\.webp/g)];
if(imagePaths.some(match=>!js.slice(match.index+match[0].length).startsWith('?v=${IMAGE_VERSION}')))throw new Error('JavaScript image URL without IMAGE_VERSION');
console.log(`Image URLs: ${version}`);
