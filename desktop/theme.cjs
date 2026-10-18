"use strict";
function branding(theme) {
  return theme === "marx"
    ? { title: "马克思的力量", icon: "build/marx-icon.png", background: "#f7f0dc" }
    : { title: "上帝的力量", icon: "build/classic-icon.png", background: "#f1f7f5" };
}
module.exports = { branding };
