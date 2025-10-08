async function r(e,n){const t=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)}),o=await t.text();if(!t.ok)throw new Error(o);return o}export{r as p};
