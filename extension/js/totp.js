// TOTP (RFC 6238) for the TU login code - shared by the popup and the login-page filler.

var TC_TOTP = (function(){
  function base32(s){
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = '', out = [];
    s = s.toUpperCase().replace(/[\s=-]/g, '');
    for(var i = 0; i < s.length; i++){
      var v = alphabet.indexOf(s[i]);
      if(v < 0) throw new Error('The key contains "' + s[i] + '", which is not valid.');
      bits += v.toString(2).padStart(5, '0');
    }
    for(var j = 0; j + 8 <= bits.length; j += 8) out.push(parseInt(bits.substr(j, 8), 2));
    return new Uint8Array(out);
  }

  // Accepts a bare base32 key or an otpauth://totp/... URI (from the QR code).
  function parse(input){
    // Copying from a terminal can add line breaks inside the link or text before it.
    input = (input || '').replace(/\s+/g, '');
    var at = input.toLowerCase().indexOf('otpauth://');
    if(at > 0) input = input.slice(at);
    else if(at < 0 && /secret=/i.test(input)) input = (/secret=([A-Za-z2-7=]+)/i.exec(input) || [])[1] || input;
    var cfg = {secret: input, digits: 6, period: 30, algorithm: 'SHA-1', label: ''};
    if(/^otpauth:\/\//i.test(input)){
      var url = new URL(input);
      if(url.host.toLowerCase() !== 'totp') throw new Error('Only time-based (TOTP) keys are supported.');
      var p = url.searchParams;
      cfg.secret = p.get('secret') || '';
      cfg.digits = parseInt(p.get('digits'), 10) || 6;
      cfg.period = parseInt(p.get('period'), 10) || 30;
      cfg.algorithm = {SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512'}[(p.get('algorithm') || 'SHA1').toUpperCase()] || 'SHA-1';
      cfg.label = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }
    cfg.secret = cfg.secret.toUpperCase().replace(/[\s=-]/g, '');
    if(base32(cfg.secret).length < 10) throw new Error('That key looks too short.');
    return cfg;
  }

  async function code(cfg, now){
    now = now || Date.now();
    var counter = Math.floor(now / 1000 / cfg.period), msg = new Uint8Array(8);
    for(var i = 7; i >= 0; i--){ msg[i] = counter & 0xff; counter = Math.floor(counter / 256); }
    var key = await crypto.subtle.importKey('raw', base32(cfg.secret), {name: 'HMAC', hash: cfg.algorithm}, false, ['sign']);
    var h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
    var o = h[h.length - 1] & 0xf;
    var n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % Math.pow(10, cfg.digits)).padStart(cfg.digits, '0');
  }

  function remaining(cfg, now){
    return cfg.period - Math.floor((now || Date.now()) / 1000) % cfg.period;
  }

  return {parse: parse, code: code, remaining: remaining};
})();
