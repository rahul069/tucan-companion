// Translates German leftovers on TUCaN's English pages.
// 1) A fixed dictionary of common TUCaN terms (instant, works offline).
// 2) Chrome's on-device Translator API for anything still German (if available).

(function(){
  // Only act when TUCaN itself is in English (the language switch then offers "Deutsch").
  if(!document.querySelector('.img_LangGerman')) return;

  // Longer phrases first so they win over the single words they contain.
  var DICT = [
    // Module and course descriptions
    ['Qualifikationsziele / Lernergebnisse', 'Learning outcomes'],
    ['Voraussetzung für die Teilnahme', 'Prerequisites for participation'],
    ['Voraussetzungen für die Teilnahme', 'Prerequisites for participation'],
    ['Ergänzung zur Prüfungsform', 'Supplement to the examination form'],
    ['Notwendige Voraussetzungen', 'Required prerequisites'],
    ['Empfohlene Voraussetzungen', 'Recommended prerequisites'],
    ['Qualifikationsziele', 'Learning outcomes'],
    ['Lernergebnisse', 'Learning outcomes'],
    ['Lehrinhalte', 'Course content'],
    ['Verwendbarkeit', 'Applicability'],
    ['Literatur', 'Literature'],
    ['Lehrformen', 'Teaching methods'],
    ['Lehrform', 'Teaching method'],
    ['Angebotsturnus', 'Offered'],
    ['Unterrichtssprache', 'Language of instruction'],
    ['Lehrsprache', 'Language of instruction'],
    ['Leistungspunkte', 'Credits'],
    ['Prüfungsform', 'Examination form'],
    ['Prüfungsdauer', 'Examination duration'],
    ['Modulbeschreibung', 'Module description'],
    ['Modulverantwortliche', 'Module owners'],
    ['Modulverantwortlicher', 'Module owner'],
    ['Arbeitsaufwand', 'Workload'],
    ['Selbststudium', 'Self-study'],
    ['Präsenzzeit', 'Contact hours'],
    ['Bemerkungen', 'Remarks'],
    ['Bemerkung', 'Remark'],
    ['Empfohlen', 'Recommended'],
    ['jedes Wintersemester', 'every winter semester'],
    ['jedes Sommersemester', 'every summer semester'],
    ['jedes Semester', 'every semester'],
    // Degree programmes (B.Sc./M.Sc. … Informatik)
    ['Wirtschaftsinformatik', 'Business Informatics'],
    ['Informationssystemtechnik', 'Information Systems Technology'],
    ['Elektrotechnik und Informationstechnik', 'Electrical Engineering and Information Technology'],
    ['Wirtschaftsingenieurwesen', 'Industrial Engineering'],
    ['Maschinenbau', 'Mechanical Engineering'],
    ['Psychologie', 'Psychology'],
    ['Mathematik', 'Mathematics'],
    ['Informatik', 'Computer Science'],
    ['Physik', 'Physics'],
    ['Fachprüfungen aus den Wahlbereichen des', 'Subject examinations from the elective areas of the'],
    ['Wahlbereiche und Studium Generale', 'Elective Areas and General Studies'],
    ['Studium Generale', 'General Studies'],
    ['Wahlbereich Mensch, Gesellschaft, Wirtschaft', 'Elective Area: Humanities, Society, Economics'],
    ['Wahlbereich Sprachen', 'Elective Area: Languages'],
    ['Studienbegleitende Leistungen', 'Accompanying Study Achievements'],
    ['Zurück zu dieser Anleitung', 'Back to these instructions'],
    ['Wahlpflichtbereich', 'Compulsory Elective Area'],
    ['Pflichtbereich', 'Compulsory Area'],
    ['Wahlbereiche', 'Elective Areas'],
    ['Wahlbereich', 'Elective Area'],
    ['Modulabschlussprüfung', 'Final Module Examination'],
    ['Wiederholungsprüfung', 'Resit Examination'],
    ['mündliche / schriftliche Prüfung', 'oral / written Examination'],
    ['mündliche Prüfung', 'Oral Examination'],
    ['schriftliche Prüfung', 'Written Examination'],
    ['Sonderprüfungstermin', 'special exam date'],
    ['Fachprüfungen', 'Subject Examinations'],
    ['Fachprüfung', 'Subject Examination'],
    ['Prüfungen', 'Examinations'],
    ['Prüfung', 'Examination'],
    ['Nachklausur', 'Resit Exam'],
    ['Klausur', 'Written Exam'],
    ['Studienleistungen', 'Coursework'],
    ['Studienleistung', 'Coursework'],
    ['Leistungen', 'Achievements'],
    ['Masterarbeit', "Master's Thesis"],
    ['Bachelorarbeit', "Bachelor's Thesis"],
    ['Abschlussarbeit', 'Final Thesis'],
    ['Hausarbeit', 'Term Paper'],
    ['Vorlesung', 'Lecture'],
    ['Übung', 'Exercise'],
    ['Praktikum', 'Lab Course'],
    ['Projektseminar', 'Project Seminar'],
    ['Anmeldung', 'Registration'],
    ['Abmeldung', 'Deregistration'],
    ['nicht bestanden', 'failed'],
    ['bestanden', 'passed'],
    ['unvollständig', 'incomplete'],
    ['vollständig', 'complete'],
    ['Hauptmenü', 'Main Menu'],
    ['Inhalt', 'Content'],
    ['Sonstige', 'Other'],
    // German grade words
    ['nicht ausreichend', 'insufficient (fail)'],
    ['mangelhaft', 'poor (fail)'],
    ['sehr gut', 'very good'],
    ['befriedigend', 'satisfactory'],
    ['ausreichend', 'sufficient'],
    ['gut', 'good'],
    // Exam states
    ['Krankschreibung', 'Sick note'],
    ['Kurse', 'Courses'],
    ['Direkte Zulassung', 'Direct admission'],
    ['Vorlesungszeit', 'Lecture period'],
    ['nicht erschienen', 'absent'],
    ['entschuldigt', 'excused'],
    ['abgemeldet', 'deregistered'],
    ['angemeldet', 'registered'],
    ['Rücktritt', 'Withdrawal'],
    ['Attest', 'Medical certificate'],
    ['mündliche', 'oral'],
    ['mündlich', 'oral'],
    ['schriftliche', 'written'],
    ['schriftlich', 'written'],
    ['(Wh.)', '(repeat)'],
    ['N.N.', 'Instructor TBA'],
    // Course short names, senders, fees, semesters (messages, schedules)
    ['Disk. u. Grammatik', 'Discussion and Grammar'],
    ['Deutsch GK', 'German Basic Course'],
    ['Beitragsmanagement', 'Fee Management'],
    ['Fehlender Semesterbeitrag', 'Outstanding semester fee'],
    ['Semesterbeitrag', 'Semester fee'],
    ['Rückmeldung', 'Re-registration'],
    ['Wintersemester', 'Winter Semester'],
    ['Sommersemester', 'Summer Semester'],
    ['Nachricht', 'Message'],
    ['Nachrichten', 'Messages'],
    ['Posteingang', 'Inbox'],
    ['Postausgang', 'Outbox'],
    ['Betreff', 'Subject'],
    ['Absender', 'Sender'],
    ['Empfänger', 'Recipient'],
    ['Löschen', 'Delete'],
    ['Antworten', 'Reply'],
    ['Termine', 'Appointments'],
    ['Termin', 'Appointment'],
    ['Raum', 'Room'],
    ['Lehrende', 'Lecturers'],
    ['Dozent', 'Lecturer'],
    ['Veranstaltung', 'Course'],
    ['Veranstaltungen', 'Courses'],
    ['Anmeldefrist', 'Registration period'],
    ['Abmeldefrist', 'Deregistration period'],
    ['Frist', 'Deadline']
  ];
  DICT.sort(function(a, b){ return b[0].length - a[0].length; });
  var RULES = DICT.map(function(p){
    return [new RegExp('(?<!\\p{L})' + p[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\p{L})', 'gu'), p[1]];
  });

  // Signals that a string is (still) German, to avoid "translating" English course names.
  var GERMAN = /[äöüÄÖÜß]|(?<!\p{L})(und|der|die|das|des|den|dem|für|mit|von|aus|zur|zum|im|nicht|oder|bei|nach|über|ist|sind|wird|werden|wurde|Sie|Ihr|Ihre|Ihnen|ein|eine|einen|auf|zu|als|auch|noch|bitte|sich|wir|uns|Sehr geehrte|Liebe|Mit freundlichen)(?!\p{L})/u;

  function textNodes(){
    var out = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var p = n.parentElement;
        if(!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|NOSCRIPT)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if(p.closest('.img_LangGerman, #pageHeadSwitchLang, .tc-header, [translate="no"]')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    while(walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  function remember(node, original){
    var p = node.parentElement;
    if(p && !p.title) p.title = original.trim();
  }

  // TUCaN often sends "German text --- English text"; keep only the English half.
  var BILINGUAL = /^(\s*)(.+?)\s+-{2,}\s+(.+?)(\s*)$/;

  // Pass 1: dictionary
  var leftovers = [];
  textNodes().forEach(function(n){
    var before = n.nodeValue, after = before;
    var bi = BILINGUAL.exec(before);
    if(bi && !GERMAN.test(bi[3])) after = bi[1] + bi[3] + bi[4];
    RULES.forEach(function(r){ after = after.replace(r[0], r[1]); });
    if(after !== before){ n.nodeValue = after; remember(n, before); }
    if(GERMAN.test(n.nodeValue)) leftovers.push(n);
  });

  // Pass 2: Chrome's built-in, on-device translator for whatever is left.
  if(!leftovers.length || typeof Translator === 'undefined') return;

  function run(){
    Translator.create({sourceLanguage: 'de', targetLanguage: 'en'}).then(function(tr){
      leftovers.forEach(function(n){
        var original = n.nodeValue;
        tr.translate(original).then(function(t){
          if(t && t !== original){ n.nodeValue = t; remember(n, original); }
        }).catch(function(){});
      });
    }).catch(function(){});
  }

  Translator.availability({sourceLanguage: 'de', targetLanguage: 'en'}).then(function(state){
    if(state === 'available') run();
    // First use: Chrome must download the language model, which needs a click on the page.
    else if(state === 'downloadable' || state === 'downloading')
      document.addEventListener('click', run, {once: true});
  }).catch(function(){});
})();
