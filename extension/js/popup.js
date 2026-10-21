// Toolbar popup: live sign-in code with countdown, copy on click, setup and options.

var $id = function(id){ return document.getElementById(id); };
var cfg = null, timer = null;

function show(view){ $id('main').hidden = view !== 'main'; $id('setup').hidden = view !== 'setup'; }

async function tick(){
  if(!cfg) return;
  var code = await TC_TOTP.code(cfg), left = TC_TOTP.remaining(cfg);
  var half = Math.ceil(code.length / 2);
  $id('digits').textContent = code.slice(0, half) + ' ' + code.slice(half);
  $id('code').dataset.code = code;
  $id('left').textContent = 'New code in ' + left + ' s';
  $id('bar').style.width = (left / cfg.period * 100) + '%';
  $id('bar').classList.toggle('low', left <= 5);
}

function start(){
  show('main');
  tick();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

chrome.storage.local.get(['otp', 'otpAutofill', 'otpAutosubmit'], function(s){
  $id('autofill').checked = s.otpAutofill !== false;
  $id('autosubmit').checked = !!s.otpAutosubmit;
  syncToggles();
  if(s.otp){ cfg = s.otp; start(); } else show('setup');
});

function syncToggles(){
  $id('autosubmit').closest('.toggle').classList.toggle('off', !$id('autofill').checked);
}
$id('autofill').addEventListener('change', function(){ chrome.storage.local.set({otpAutofill: this.checked}); syncToggles(); });
$id('autosubmit').addEventListener('change', function(){ chrome.storage.local.set({otpAutosubmit: this.checked}); });

$id('code').addEventListener('click', async function(){
  await navigator.clipboard.writeText(this.dataset.code || '');
  this.classList.add('copied');
  $id('copied').textContent = 'Copied ✓';
  setTimeout(function(){ $id('code').classList.remove('copied'); $id('copied').textContent = 'Click the code to copy'; }, 1500);
});

$id('save').addEventListener('click', function(){
  try{
    var parsed = TC_TOTP.parse($id('secret').value);
    chrome.storage.local.set({otp: parsed}, function(){ cfg = parsed; $id('secret').value = ''; $id('error').textContent = ''; start(); });
  } catch(e){
    $id('error').textContent = e.message || 'That key is not valid.';
  }
});
$id('secret').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); $id('save').click(); } });

$id('remove').addEventListener('click', function(){
  if(this.dataset.armed){
    chrome.storage.local.remove('otp', function(){ cfg = null; clearInterval(timer); show('setup'); });
    return;
  }
  this.dataset.armed = '1';
  this.textContent = 'Click again to remove the key';
  var btn = this;
  setTimeout(function(){ delete btn.dataset.armed; btn.textContent = 'Remove key'; }, 3000);
});

// TUPlan integration (opt-in)
chrome.storage.local.get('tuplanEnabled', function(s){ $id('tuplan').checked = !!s.tuplanEnabled; });
$id('tuplan').addEventListener('change', function(){
  chrome.storage.local.set({tuplanEnabled: this.checked});
  if(!this.checked) chrome.storage.local.remove('tuplanDigest');
});
