'use strict';
function point(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.abs(value.x)>100000 || Math.abs(value.y)>100000) throw Error('INVALID_POINTER');
  return {x:value.x,y:value.y};
}
function move(drag,value) {
  const next=point(value), dx=next.x-drag.cursor.x, dy=next.y-drag.cursor.y;
  return {x:Math.round(drag.bounds.x+dx),y:Math.round(drag.bounds.y+dy),moved:drag.moved||Math.hypot(dx,dy)>4};
}
module.exports={point,move};
