// ==UserScript==
// @name            DodoCTRL
// @namespace       https://dodoctrl.github.io/
// @version         1.0.0
// @author          Ilia Bayanov https://vk.com/ilia_bayanov
// @description     Automatic registration for quality control in Dodo Pizza
// @description:ru  Автоматическая регистрация на проверку в Додо Пицце
// @updateURL       https://github.com/dodoctrl/dodoctrl.github.io/raw/main/userscript/dodoctrl.user.js
// @downloadURL     https://github.com/dodoctrl/dodoctrl.github.io/raw/main/userscript/dodoctrl.user.js
// @match           https://lk.dodocontrol.ru/
// @icon            https://lk.dodocontrol.ru/images/personalarea/favicon-16x16.png
// @run-at          document-body
// @grant           none
// ==/UserScript==

(() => {
  'use strict';

  // ==КОНСТАНТЫ==
  // Номер пиццерии, в которой надо занять проверку, как она отображается на странице, НЕ индекс в HTML-коллекции.
  const PIZZERIA = 1;
  // Тип проверки, которую надо занять, 1 - доставка, 2 - ресторан, 3 - инспекция.
  const CHECK_TYPE = 1;
  // Порядок дат, которые подходят для проверки. Иногда открывают не все 3, а 2 или 1 дату, надо расставить приоритет.
  const DATES_PRIORITY = [2, 1, 3];
  // Длительность таймера обновления в обычном режиме в СЕКУНДАХ. По умолчанию режим работает с 9:00 до 21:00 МСК.
  const USUAL_TIMER = 20;
  // Утренний и ночной режимы названы так в соответствии со временем МСК. Я заметил, что проверки обычно открывают
  // с 9:00 до 21:00 МСК. Редко бывает, что раньше 9:00, но для этого мы и используем утренний режим. Если ваш часовой
  // пояс отличается от МСК, то учитывайте разницу во времени при установке начала действия таймера.
  // Длительность утреннего режима 1 час. По прошествии часа включается обычный режим.
  // Длительность таймера в МИНУТАХ и начало действия режима "утро" в ЧАСАХ, когда вероятность появления проверок невысока.
  const MORNING_TIMER = 5;
  const MORNING_BEGINS = 8;
  // Длительность таймера в МИНУТАХ и начало действия режима "ночь" в ЧАСАХ. Когда вы не хотите настраивать компьютер утром.
  // Сайт проверок будет обновляться редко до наступления режима "утро".
  // Не рекомендую ставить больше 60 минут, считаю оптимальным обновлять страницу раз в пол часа.
  const NIGHT_TIMER = 30;
  const NIGHT_BEGINS = 21;
  // ==/КОНСТАНТЫ==

  const getOpenCheck = () => {
    const pizzerias = document.getElementsByClassName('pizzeria__list');

    if (pizzerias.length) {
      const pizzeria = pizzerias[PIZZERIA - 1];
      const checkType = pizzeria.getElementsByClassName('col-sm-4')[CHECK_TYPE - 1];
      const dates = checkType.getElementsByClassName('type__date-item');

      return dates[DATES_PRIORITY[0] - 1] || dates[DATES_PRIORITY[1] - 1] || dates[DATES_PRIORITY[2] - 1];
    }
  };

  const findElementWithTextInside = (text, parent = document) => {
    const allElements = parent.getElementsByTagName('*');

    return [...allElements].find(item => item.innerText === text);
  };

  const setNameOfDateNow = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const siren = (freq = 500, vol = 0.1) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = freq;
    oscillator.connect(gainNode);
    gainNode.gain.value = vol;
    gainNode.connect(audioCtx.destination);

    let up = false;
    let i = 0;

    const freqChanger = (Hz) => {
      if (i % 25 === 0) { up = !up }

      if (i < 150) {
        i++;
        oscillator.frequency.value = Hz;
        setTimeout(() => {
          if (up) {
            freqChanger(Hz + 20);

            return;
          }
          freqChanger(Hz - 20);
        });

        return;
      }

      oscillator.stop();
    };

    oscillator.start();
    freqChanger(freq + 20);
  };

  const saveRoot = () => {
    const root = document.getElementById('root').outerHTML;

    for (let elem in localStorage) {
      if (localStorage[elem] === root) {
        return;
      }
    }

    localStorage[setNameOfDateNow()] = root;
  };

  const setReloadTimeOut = () => {
    const now = new Date();
    let reloadTimeOut = USUAL_TIMER * 1000;

    if ((now.getHours() >= NIGHT_BEGINS) || (now.getHours() < MORNING_BEGINS)) { reloadTimeOut = NIGHT_TIMER * 60 * 1000 }

    if (now.getHours() === MORNING_BEGINS) { reloadTimeOut = MORNING_TIMER * 60 * 1000 }

    console.log(`Следующее обновление в ${new Date(+now + reloadTimeOut)}`);

    return reloadTimeOut;
  };

  const signUpForCheck = () => {
    const date = getOpenCheck();

    if (date) {
      clearTimeout(timerReload);
      observer.disconnect();
      siren();
      saveRoot();
      date.click();
      saveRoot();
      setTimeout(() => {
        document.querySelector('.pizzeria__button_primary').click();
        saveRoot();
        setTimeout(() => findElementWithTextInside('Принимаю проверку').click());
      });
    } else {
      clearTimeout(timerReload);
      timerReload = setTimeout(() => {
        saveRoot();
        location.reload()
      }, setReloadTimeOut());
    }
  };

  const handleMutation = () => {
    if (document.getElementsByClassName('pizzeria__list').length) {
      signUpForCheck();
    } else {
      clearTimeout(timerReload);
      timerReload = setTimeout(() => {
        saveRoot();
        location.reload()
      }, setReloadTimeOut());
    }
  };

  let timerReload = null;

  const observer = new MutationObserver(handleMutation);
  observer.observe(document, {
    childList: true,
    subtree: true,
  });
})();
