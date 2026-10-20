// Rebuilds TUCaN's header as a clean two-row bar.
// TUCaN pins each header piece at fixed pixel offsets meant for a wide layout, so
// they collide on narrower windows. We move the real elements into our own bar
// instead of restyling them in place. If anything we rely on is missing (e.g. the
// login page), we do nothing and the page keeps the plain themed header.

(function(){
  var head = document.getElementById('pageHead');
  var nav = document.getElementById('pageTopNavi');
  var login = document.getElementById('loginData');
  if(!head || !nav) return;  // login info is optional: logged-out pages get the bar too

  // TUCaN collapses the sub-menus of inactive sections; our stylesheet gives every
  // sub-menu a border, so a collapsed one is still a couple of pixels tall.
  function isShown(ul){ return ul.getBoundingClientRect().height > 20; }
  function el(tag, cls){ var e = document.createElement(tag); if(cls) e.className = cls; return e; }
  function word(main, small){
    var w = el('span', 'tc-word');
    w.appendChild(document.createTextNode(main));
    if(small){ var s = el('small'); s.textContent = small; w.appendChild(s); }
    return w;
  }

  var bar = el('div', 'tc-header');
  var main = el('div', 'tc-main');
  var sub = el('div', 'tc-sub');

  // Row 1: TUCaN | main menu | TU Darmstadt (as text: the logos belong to TU Darmstadt)
  var firstLink = nav.querySelector('a.depth_1');
  var home = el('a', 'tc-logo');
  home.href = firstLink ? firstLink.href : '#';
  home.appendChild(word('TUCaN'));

  var menu = el('nav', 'tc-menu');
  nav.querySelectorAll('li.depth_1').forEach(function(li){
    var a = li.querySelector('a.depth_1');
    if(!a) return;
    var link = el('a');
    link.href = a.href;
    link.textContent = a.textContent.trim();
    // The section whose sub-menu is currently shown as the sidebar is the active one.
    var subMenu = li.querySelector('ul.depth_2');
    if(subMenu && isShown(subMenu)) link.className = 'active';
    menu.appendChild(link);
  });

  var tu = el('a', 'tc-tu');
  tu.href = 'https://www.tu-darmstadt.de';
  tu.target = '_blank';
  tu.rel = 'noopener';
  tu.appendChild(word('TU Darmstadt', 'Technische Universität'));

  main.appendChild(home);
  main.appendChild(menu);
  main.appendChild(tu);

  // Row 2: login info | language + log in/out
  var actions = el('div', 'tc-actions');
  document.querySelectorAll('#pageHeadSwitchLang a, a#logIn_btn').forEach(function(a){
    if(a.parentNode === actions) return;
    if(/^(Log in|Login|Anmelden)$/i.test(a.textContent.trim())) a.classList.add('tc-login');
    actions.appendChild(a);
  });
  if(login) sub.appendChild(login);
  else { var guest = el('span', 'tc-guest'); guest.textContent = 'Not logged in'; sub.appendChild(guest); }
  sub.appendChild(actions);

  bar.appendChild(main);
  bar.appendChild(sub);
  head.insertBefore(bar, head.firstChild);
  document.documentElement.classList.add('tc-header-on');

  // The sidebar is TUCaN's level-2 menu, which hangs off the (now hidden) top
  // navigation. Shift that navigation so the sidebar lands in the sidebar column.
  function alignSidebar(){
    var column = document.getElementById('pageLeft');
    var side = Array.prototype.find.call(nav.querySelectorAll('ul.depth_2'), isShown);
    if(!column || !side) return;
    side.classList.add('tc-side');
    var want = column.getBoundingClientRect(), have = side.getBoundingClientRect();
    var cs = getComputedStyle(nav);
    nav.style.setProperty('top', (parseFloat(cs.top) + want.top - have.top) + 'px', 'important');
    nav.style.setProperty('left', (parseFloat(cs.left) + want.left - have.left) + 'px', 'important');
  }
  alignSidebar();
  window.addEventListener('resize', alignSidebar);
  window.addEventListener('load', alignSidebar);
  if(document.fonts) document.fonts.ready.then(alignSidebar);
})();
