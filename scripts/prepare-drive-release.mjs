import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const {version}=JSON.parse(await readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Expected a stable semantic version');
const source=path.join('release',`上帝的力量-${version}-win.zip`),bytes=await readFile(source);
const digest=createHash('sha256').update(bytes).digest('hex');
const out=path.join('release','drive',version);await mkdir(out,{recursive:true});
const base=`godpower-${version}-win.zip`,parts=[];
for(let start=0,i=1;start<bytes.length;start+=90*1024*1024,i++){
 const name=base+'.'+String(i).padStart(3,'0');parts.push(name);await writeFile(path.join(out,name),bytes.subarray(start,start+90*1024*1024));
}
// ASCII names and CRLF avoid Windows console code-page corruption of filenames.
const cmd=[
 '@echo off','setlocal','cd /d "%~dp0"',
 `copy /b ${parts.map(p=>'"'+p+'"').join('+')} "${base}" >nul`,
 'if errorlevel 1 goto failed',
 `powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $zip='${base}'; if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne '${digest}'){throw 'SHA-256 mismatch'}; Expand-Archive -LiteralPath $zip -DestinationPath 'Godpower-${version}' -Force"`,
 'if errorlevel 1 goto failed',
 `echo Complete. Open Godpower-${version} and run the application.`,
 'pause','exit /b 0',':failed','echo Merge, integrity check or extraction failed. Download all parts into the same folder.','pause','exit /b 1',''
].join('\r\n');
await writeFile(path.join(out,`Merge-and-extract-${version}.cmd`),cmd,'ascii');
await writeFile(path.join(out,'SHA256SUMS.txt'),digest+'  '+base+'\n');
console.log(JSON.stringify({version,source,bytes:bytes.length,sha256:digest,out,parts},null,2));
