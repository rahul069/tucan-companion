// Module/result rows: status colours, status words in the status column, and a dark
// fallback for pages outside TUCaN's normal layout.

// Tag module rows with their status (icon on the performance record, text on module results)
// so the stylesheet can colour them.
function isResultRow(row){
  if(row.hasClass('tbdata') || row.children('td.tbdata').length) return true;
  // Some pages (e.g. exam results) use plain cells: any data row of a result table
  // that is not a header, sub-header, hierarchy or form row.
  return row.closest('table.nb').length > 0 &&
    row.children('td').length >= 2 && !row.children('th').length &&
    !row.is('[class*="level"]') && !row.children('.tbhead, .tbsubhead, .tbcontrol, [class*="level"]').length &&
    !row.find('select, input, textarea').length;
}
var FAIL = /(^|\s)(failed|nicht bestanden|nicht ausreichend|mangelhaft)(\s|$)/;
var WARN = /(^|\s)(incomplete|unvollständig|krankschreibung)(\s|$)/;
var PASS = /(^|\s)(passed|bestanden|sehr gut|gut|befriedigend|ausreichend)(\s|$)/;
$('tr').filter(function(){ return isResultRow($(this)); }).each(function(){
  var row = $(this).addClass('tc-row');
  var text = ' ' + row.children('td').map(function(){ return $(this).text().trim().toLowerCase(); }).get().join(' ') + ' ';
  var icon = row.find('img').map(function(){ return this.src; }).get().join(' ');
  var status = null;
  if(FAIL.test(text) || /fail/.test(icon)) status = 'fail';
  else if(WARN.test(text) || /incomplete/.test(icon)) status = 'incomplete';
  else if(PASS.test(text) || /pass/.test(icon)) status = 'pass';
  if(status) row.addClass('tc-' + status);
  row.children('td').each(function(){
    var t = $(this).text().trim().toLowerCase();
    // Allow suffixes such as "passed (resit)"
    if(FAIL.test(t) && FAIL.exec(t).index === 0) $(this).addClass('tc-status-fail');
    else if(WARN.test(t) && WARN.exec(t).index === 0) $(this).addClass('tc-status-incomplete');
    else if(PASS.test(t) && PASS.exec(t).index === 0) $(this).addClass('tc-status-pass');
  });
});

// TUCaN puts states like "Krankschreibung" (sick note) into the grade cell and leaves
// the status cell next to it empty. Move such a word into the status column.
$('tr.tc-row td[class*="tc-status-"]').each(function(){
  var cell = $(this), next = cell.next('td');
  if(!next.length || next.text().trim() || next.find('img, a, input').length) return;
  if(/\d/.test(cell.text())) return;  // a real grade, leave it
  next.append(cell.contents()).attr('class', cell.attr('class')).css('text-align', cell.css('text-align'));
  cell.attr('class', 'tbdata').text('–');
});

// Pages outside TUCaN's normal layout (e.g. the logout confirmation) have their own
// light styling. Darken any bright backgrounds we find and theme their buttons.
if(!document.getElementById('pageContainer')){
  document.documentElement.classList.add('tc-foreign');
  var lum = function(c){
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c);
    if(!m || (m[4] !== undefined && +m[4] < 0.5)) return 0;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  };
  var all = document.body ? document.body.querySelectorAll('*') : [];
  for(var i = 0; i < all.length && i < 4000; i++){
    var node = all[i];
    if(/^(IMG|SVG|VIDEO|CANVAS|IFRAME)$/.test(node.tagName)) continue;
    var cs = getComputedStyle(node);
    if(lum(cs.backgroundColor) > 0.75) node.style.setProperty('background-color', 'var(--surface)', 'important');
    if(lum(cs.color) < 0.35) node.style.setProperty('color', 'var(--text)', 'important');
  }
}
