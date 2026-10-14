// Inline model.js, app.js and market.js into planner.html to produce standalone.html.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const html=read('planner.html').replace(/<script src="([\w.]+)"><\/script>/g,(_,f)=>`<script>\n${read(f)}\n</script>`);
fs.writeFileSync(path.join(dir,'standalone.html'),html);
