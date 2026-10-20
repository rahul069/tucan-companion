// TU login pages ("Insert Response" / OTP step): put the current sign-in code into the
// code field, optionally submit, and always show a small TUCaN Companion chip so it's clear
// what happened (filled / no key saved yet).

(function(){
  var FIELD_HINT = /otp|totp|token|one.?time|einmal|2fa|mfa|response|code/i;
  var PAGE_HINT = /one-time-password|one.time|\bOTP\b|\bTOTP\b|Einmalpasswort|Insert Response|token/i;
  var SUBMIT = /^(Validate|Validieren|Prüfen|Überprüfen|Login|Anmelden|Sign in|Submit|Send|Absenden|Weiter|Continue|OK)$/i;

  function visible(el){ return el.offsetParent !== null && el.getBoundingClientRect().height > 0; }
  function textInputs(){
    return Array.prototype.filter.call(document.querySelectorAll('input'), function(el){
      return /^(text|tel|number|password|)$/i.test(el.getAttribute('type') || '') && !el.disabled && !el.readOnly && visible(el);
    });
  }

  function findField(){
    var inputs = textInputs();
    var named = inputs.filter(function(el){
      if(el.autocomplete === 'one-time-code') return true;
      return FIELD_HINT.test([el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' '));
    });
    if(named.length === 1) return named[0];
    // The OTP step has a single input; the username/password step has two.
    if(inputs.length === 1 && PAGE_HINT.test(document.body.innerText)) return inputs[0];
    return null;
  }

  function setValue(el, value){
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }

  var chip;
  function note(field, text, onClick){
    if(!chip){
      chip = document.createElement('div');
      chip.style.cssText = 'margin:8px 0 0;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;' +
        'border-radius:999px;background:#1d2c3e;color:#82b4e4;border:1px solid #2f4a68;' +
        'font:600 12px/1.4 system-ui,sans-serif;';
      field.insertAdjacentElement('afterend', chip);
    }
    chip.textContent = '🎓 ' + text;
    chip.style.cursor = onClick ? 'pointer' : 'default';
    chip.onclick = onClick || null;
  }

  function submitButton(form){
    var buttons = Array.prototype.slice.call((form || document).querySelectorAll('button, input[type="submit"]'));
    return buttons.filter(function(b){ return SUBMIT.test((b.textContent || b.value || '').trim()); })[0] ||
           (form && form.querySelector('button[type="submit"], input[type="submit"]'));
  }

  chrome.storage.local.get(['otp', 'otpAutofill', 'otpAutosubmit'], function(s){
    var tries = 0, done = false;
    var timer = setInterval(run, 400);
    run();

    async function fill(field){
      // Don't fill a code that expires in a moment - wait for the next one.
      var left = TC_TOTP.remaining(s.otp);
      if(left < 3){ note(field, 'Waiting for a fresh code…'); await new Promise(function(r){ setTimeout(r, left * 1000 + 300); }); }
      setValue(field, await TC_TOTP.code(s.otp));
      field.focus();
    }

    async function run(){
      if(done || ++tries > 40){ clearInterval(timer); return; }
      var field = findField();
      if(!field) return;
      done = true; clearInterval(timer);

      if(!s.otp){
        note(field, 'TUCaN Companion can fill this code – click the extension icon and add your key');
        return;
      }
      var refill = function(){ fill(field).then(function(){ note(field, 'New code filled – press Enter', refill); }); };
      if(s.otpAutofill === false){ note(field, 'Click to fill the code', refill); return; }
      if(field.value) return;
      await fill(field);

      // Submit once per minute at most: if TU rejects the code and shows the form again,
      // stop, so a wrong key can't burn through the failed-attempt limit.
      var last = +sessionStorage.getItem('tc-otp-submitted') || 0;
      var btn = submitButton(field.form);
      if(s.otpAutosubmit && btn && Date.now() - last > 60000){
        sessionStorage.setItem('tc-otp-submitted', Date.now());
        note(field, 'Code filled – signing in…');
        setTimeout(function(){ btn.click(); }, 250);
      } else {
        note(field, (last && s.otpAutosubmit ? 'Auto sign-in paused after a failed try – ' : 'Code filled – ') +
          'press Enter (click here for a new code)', refill);
      }
    }
  });
})();
