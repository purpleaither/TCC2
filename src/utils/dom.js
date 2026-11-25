export const $ = id => document.getElementById(id);
export function el(tag, content, cls) {
  const n = document.createElement(tag);
  if (content !== undefined) n.textContent = String(content);
  if (cls) n.className = cls;
  return n;
}
export function text(id,value) {
  const n = $(id);
  if(n) n.textContent = String(value);
}
