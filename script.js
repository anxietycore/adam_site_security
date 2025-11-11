// script.js — только логика переходов для index.html

document.addEventListener('DOMContentLoaded', () => {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);
});

// Эти функции вызываются из index_canvas.js
window.startBootSequence = function() {
    if (window.__startBoot) window.__startBoot();
};

window.login = function() {
    if (window.__login) window.__login();
};
