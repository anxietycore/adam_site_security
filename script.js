/* script.js
   - Содержит стартовую логику загрузки, подсчёт посещений, вариативный boot sequence,
     улучшенный UX для логина, реакции на многократные входы и "ритуал" аутентификации
   - Сохраняет и читает adam_visits и vigil_degradation (остаточная деградация) из localStorage.
*/

const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

console.log('=== A.D.A.M. DEBUG START ===');
console.log('Ожидаемые данные:', VALID_CREDENTIALS);

// ====================== Utility ======================
function $(id){ return document.getElementById(id); }
function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ====================== Visits & residual degradation ======================
document.addEventListener('DOMContentLoaded', function(){
    // increment visits
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    visits = visits + 1;
    localStorage.setItem('adam_visits', visits);
    console.log(`Посещений A.D.A.M.: ${visits}`);

    // restore residual degradation if present
    const residual = parseInt(localStorage.getItem('vigil_degradation')) || 0;
    if(residual > 0){
        console.log('Найдена остаточная деградация:', residual);
    }

    // fill boot lines dynamically with small variance
    const bootText = $('boot-text');
    const bootLinesBase = [
        "> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...",
        "> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...",
        "> ТЕСТ ПАМЯТИ: УСПЕШНО",
        "> КРИПТОМОДУЛЬ: АКТИВИРОВАН",
        "> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН",
        "> СИСТЕМА ГОТОВА"
    ];
    // add 1-2 random "error" / "recovery" lines to create uniqueness
    const anomalies = [
        "> WARNING: сектор памяти 9F-01 повреждён",
        "> попытка восстановления...",
        "> [восстановление: успешно]",
        "> КРИТИЧЕСКАЯ СИНХРОНИЗАЦИЯ: ОЖИДАНИЕ",
        "> КРИПТОМОДУЛЬ: РЫВОК",
        "> ИНИЦИАЛИЗАЦИЯ: прервана, повтор..."
    ];
    const variantCount = Math.floor(Math.random()*2)+1;
    for(let i=0;i<variantCount;i++){
        const pos = 1 + Math.floor(Math.random()*(bootLinesBase.length-1));
        bootLinesBase.splice(pos,0, randChoice(anomalies) );
    }

    // render boot lines as hidden paragraphs
    bootText.innerHTML = '';
    bootLinesBase.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        bootText.appendChild(p);
    });

    // attach start button handler
    $('start-btn').addEventListener('click', function(){
        console.log('Кнопка запуска нажата');
        startBootSequence();
    });

    // quick focus for login enter handling
    document.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !document.hidden){
            if(!$('login-screen').classList.contains('hidden')){
                login();
            }
        }
    });

    // Debug hotkey: Ctrl+Alt+D -> enable debug mode logs in console
    document.addEventListener('keydown', function(e){
        if(e.ctrlKey && e.altKey && e.key.toLowerCase()==='d'){
            console.log('=== DEBUG MODE ENABLED ===');
            alert('A.D.A.M. DEBUG MODE: консоль показывает скрытые логи.');
        }
    });
});

// ====================== Boot sequence ======================
function startBootSequence(){
    const startScreen = $('start-screen');
    const bootScreen = $('boot-screen');
    startScreen.classList.add('hidden');
    bootScreen.classList.remove('hidden');

    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let i = 0;

    function showNext(){
        if(i < bootTexts.length){
            const p = bootTexts[i];
            // introduce chance to "hang" on critical line
            if(Math.random() < 0.12){
                p.textContent = p.textContent + " [ПОДВИСАНИЕ]";
                p.style.opacity = 1;
                i++;
                setTimeout(showNext, 1200 + Math.random()*1500);
            } else {
                p.style.opacity = 1;
                i++;
                setTimeout(showNext, 700 + Math.random()*600);
            }
        } else {
            setTimeout(showLoginScreen, 900);
        }
    }
    setTimeout(showNext, 400);
}

// ====================== Login screen ======================
function showLoginScreen(){
    $('boot-screen').classList.add('hidden');
    $('login-screen').classList.remove('hidden');
    $('username').focus();

    // subtle flicker to make layers feel different
    setTimeout(()=> {
        document.body.style.transition = 'filter 0.5s linear';
        document.body.style.filter = 'brightness(1.02)';
        setTimeout(()=> document.body.style.filter = '', 700);
    }, 400);
}

document.getElementById('login-btn').addEventListener('click', login);

function login(){
    const username = $('username').value.trim();
    const password = $('password').value;
    const errorElement = $('login-error');

    console.log('=== ПОПЫТКА ВХОДА ===');

    // fancy "identification..." ritual
    errorElement.classList.add('hidden');
    errorElement.textContent = '';

    const statusLine = document.createElement('p');
    statusLine.textContent = '> идентификация...';
    statusLine.style.color = 'rgba(200,255,200,0.7)';
    statusLine.className = 'boot-status';
    $('login-screen').appendChild(statusLine);

    setTimeout(()=> {
        // simulate scanning sound by breathing effect (no audio file on start page)
        if(username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password){
            statusLine.textContent = '> идентификация подтверждена';
            statusLine.style.color = 'var(--phosphor)';
            setTimeout(()=> {
                statusLine.textContent = '> нейроскан завершён';
                setTimeout(()=> {
                    statusLine.textContent = '> добро пожаловать обратно, оператор';
                    // fade and redirect
                    document.body.style.transition = 'opacity 0.8s';
                    document.body.style.opacity = '0';
                    setTimeout(()=> {
                        // pass through residual degradation to terminal page by saving to localStorage (already stored)
                        window.location.href = 'terminal.html';
                    }, 800);
                }, 700);
            }, 500);
        } else {
            // failed ritual with paranoia behavior
            statusLine.textContent = '> отказ системы';
            statusLine.style.color = 'var(--blood)';
            setTimeout(()=> {
                // show lingering messages and a short blackout
                statusLine.textContent = '> вторжение зафиксировано';
                setTimeout(()=> {
                    statusLine.remove();
                    // brief blackout
                    document.body.style.transition = 'opacity 0.25s';
                    document.body.style.opacity = '0';
                    setTimeout(()=> {
                        document.body.style.opacity = '1';
                        // show error
                        $('login-error').textContent = 'ДОСТУП ЗАПРЕЩЁН';
                        $('login-error').style.color = 'var(--blood)';
                        $('login-error').classList.remove('hidden');
                        $('password').value = '';
                        $('username').focus();
                    }, 500);
                }, 800);
            }, 600);
        }
    }, 800);

}
