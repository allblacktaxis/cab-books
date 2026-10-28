#!/usr/bin/env python3
"""Turn the Claude-hosted Cab Books page into the standalone website version.

Input : index.html            (Cab Books page, with per-driver + mode logic)
Output: web/public/index.html (Firebase sign-in, Firestore per driver, normal downloads)
        web/public/icon-*.png  (home-screen icons from the app logo)
        web/public/offline-map/ (fare calculator map style, fonts, MapLibre + PMTiles,
                                 unpacked from map_assets_part*.txt when they sit beside this script)
The fare calculator also needs web/public/cab-config.js (Geoapify key), kept beside firebase-config.js.
"""
import base64, glob, io, re, os, sys, tarfile

SRC = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = 'web/public'
os.makedirs(OUT, exist_ok=True)
s = open(SRC, encoding='utf-8').read()


def rep(a, b, count=1):
    global s
    n = s.count(a)
    if n != count:
        raise SystemExit(f'anchor found {n} times (expected {count}): {a[:80]!r}')
    s = s.replace(a, b)


# ---------------------------------------------------------------- head
head_end = s.index('</style>', s.index('<style>\n/* Layout')) + len('</style>')
body_start = s.index('<div class="wrap">')
app_style = s[s.index('<style>\n/* Layout'):head_end]
FB = 'https://www.gstatic.com/firebasejs/10.12.2/'
new_head = (
    '<!doctype html>\n<html lang="en-GB">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<title>Cab Books</title>\n'
    '<meta name="description" content="Income, expenses and VAT tracking for London taxi drivers.">\n'
    '<meta name="theme-color" content="#000000">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black">\n'
    '<meta name="apple-mobile-web-app-title" content="Cab Books">\n'
    '<link rel="manifest" href="/manifest.webmanifest">\n'
    '<link rel="icon" type="image/png" href="/icon-192.png">\n'
    '<link rel="apple-touch-icon" href="/icon-180.png">\n'
    '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'html{scroll-padding-top:env(safe-area-inset-top,0px);background:#000}body{margin:0;padding:0}img{max-width:100%}'
    '[hidden]:not([hidden=until-found i]){display:none!important}</style>\n'
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n'
    f'<script src="{FB}firebase-app-compat.js"></script>\n'
    f'<script src="{FB}firebase-auth-compat.js"></script>\n'
    f'<script src="{FB}firebase-firestore-compat.js"></script>\n'
    '<script src="/firebase-config.js"></script>\n'
    '<script src="/cab-config.js"></script>\n'
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">\n'
    + app_style + '\n</head>\n<body>\n'
)
s = new_head + s[body_start:]
rep('</script>\n\n</body></html>', '</script>\n</body>\n</html>\n')

# ---------------------------------------------------------------- login screen
LOGIN_CSS = """
#signin{position:fixed;inset:0;z-index:60;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px 16px;overflow:auto}
#signin .box{width:min(100%,400px);display:flex;flex-direction:column;gap:14px}
#signin .lg{display:flex;align-items:center;gap:12px;margin-bottom:6px}
#signin .lg img{width:56px;height:56px;border-radius:14px}
#signin .lg b{display:block;font-size:22px}
#signin .lg span{display:block;font-size:13px;color:var(--muted)}
#signin input[type=email],#signin input[type=password],#signin input[type=text]{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;min-height:48px;font-size:16px;color:var(--ink)}
#signin .err{color:var(--bad);font-size:13px;min-height:18px;margin:0}
#signin .alt{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
#signin .alt button{background:none;border:0;color:var(--accent);font:inherit;font-size:14px;cursor:pointer;padding:8px 0;min-height:40px}
#signin .fine{font-size:12px;color:var(--muted);margin:0}
#signin .fine a{color:var(--muted)}
.acct{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.acct .em{font-size:14px;word-break:break-all}
"""
rep('#set-body{display:flex;flex-direction:column;gap:14px}\n',
    '#set-body{display:flex;flex-direction:column;gap:14px}\n' + LOGIN_CSS)

LOGIN_HTML = """<div id="signin" hidden role="dialog" aria-modal="true" aria-labelledby="si-t">
  <form class="box" id="si-form" novalidate>
    <div class="lg"><img id="si-logo" alt="" width="56" height="56"><div><b id="si-t">Cab Books</b><span>Income, expenses and VAT for taxi drivers</span></div></div>
    <p class="privnote">Each driver's books are private. Only you can see what you put in.</p>
    <div class="field" style="margin:0"><label for="si-email">Email</label><input type="email" id="si-email" autocomplete="email" required></div>
    <div class="field" style="margin:0"><label for="si-pass">Password</label><input type="password" id="si-pass" autocomplete="current-password" minlength="8" required></div>
    <p class="err" id="si-err" role="alert"></p>
    <button class="btn" type="submit" id="si-go">Sign in</button>
    <div class="alt"><button type="button" id="si-switch">New here? Create an account</button><button type="button" id="si-forgot">Forgot password?</button></div>
    <p class="fine">New to Cab Books? <a href="/help.html" style="color:var(--accent)">Read the getting-started guide</a>.</p>
    <p class="fine">By using Cab Books you agree to how we look after your data: <a href="/privacy.html">privacy notice</a>.</p>
  </form>
</div>
"""
rep('<div class="toast" id="toast" hidden></div>', LOGIN_HTML + '<div class="toast" id="toast" hidden></div>')

# ---------------------------------------------------------------- downloads: normal browser save
rep("(window.claude&&window.claude.use?window.claude.use('downloads'):Promise.resolve(null))",
    "Promise.resolve(WEBDL)")

# ---------------------------------------------------------------- wording
rep("Your numbers are saved to your Claude account. Open this page while signed in.", "Sign in to Cab Books to see your own figures.")
rep("Add a job on the Today tab, import a statement, or ask Claude in your chat to load your monthly figures.",
    "Add a job on the Today tab or import a statement to get started.")
rep("Claude goes through these next time you work on the app.", "We read these and use them to improve the app.")
rep("Your numbers are saved to your Claude account.</div>", "Sign in to Cab Books to see your figures.</div>")
rep("Receipts are saved to your Claude account.</div>", "Sign in to Cab Books to keep receipts.</div>")

# ---------------------------------------------------------------- per-driver: no owner special case on the web
rep("S.mode=md||(S.isOwner?'full':null);", "S.mode=md||null;")
rep("var needWelcome=!S.isOwner&&S.loaded.settings&&!S.mode;", "var needWelcome=S.loaded.settings&&!S.mode;")
rep("+(S.isOwner?'':'<p class=\"privnote\" style=\"margin-top:10px\">Your figures are private to you. Nobody else using Cab Books can see them.</p>')+'</div>';",
    "+'<p class=\"privnote\" style=\"margin-top:10px\">Your figures are private to you. Nobody else using Cab Books can see them.</p></div>';\n  }\n"
    "  function renderAccountCard(){\n"
    "    var u=S.authUser; if(!u) return '';\n"
    "    return '<div class=\"card\"><h2>Your account</h2><div class=\"acct\"><span class=\"em\">'+esc(u.email||'')+'</span>'\n"
    "      +'<button class=\"btn ghost small\" type=\"button\" id=\"acct-out\">Sign out</button></div>'\n"
    "      +'<div style=\"margin-top:12px\"><label for=\"acct-imp\">Bring in data from the old Cab Books</label>'\n"
    "      +'<p class=\"help\" style=\"margin:0 0 8px\">Choose the backup file (.json) saved from the old app. Records already here with the same number are replaced, nothing else is touched.</p>'\n"
    "      +'<label style=\"display:flex;gap:8px;align-items:center;margin:0 0 8px;font-weight:400\"><input type=\"checkbox\" id=\"acct-rep\"> Start fresh: clear what is already here first (use this on switch-over day)</label>'\n"
    "      +'<input type=\"file\" id=\"acct-imp\" accept=\".json,application/json\"></div>'\n"
    "      +'<p class=\"help\" style=\"margin:12px 0 0\"><a href=\"/help.html\" style=\"color:var(--accent)\">Getting-started guide</a> &middot; <a href=\"/privacy.html\" style=\"color:var(--accent)\">Privacy notice</a></p></div>';")
rep("h=renderModeCard()+renderLookCard()", "h=renderAccountCard()+renderModeCard()+renderLookCard()")

# ---------------------------------------------------------------- boot: Firebase instead of Claude
b0 = s.index("  /* ---------- who is using the app: private books per person ----------")
b1 = s.index("  } else { $('sync').textContent='Open in Claude to save'; }") + len("  } else { $('sync').textContent='Open in Claude to save'; }")
BOOT = r"""  /* ---------- website plumbing: Firebase sign-in + each driver's private books ----------
     Every driver's records live under users/<their uid>/<collection>/<id>.
     The security rules (firestore.rules) let a signed-in driver read and write
     only their own users/<uid> branch. Suggestions are one shared box. */
  var SHARED_COLS={suggestions:1};
  var WEBDL={save:function(o){
    try{
      var blob=o.data instanceof Blob?o.data:new Blob([o.data],{type:o.type||'application/pdf'});
      var url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download=o.filename||'download'; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },4000);
      return Promise.resolve();
    }catch(e){ return Promise.reject(e); }
  }};
  function driverDb(fs,uid){
    var home=fs.collection('users').doc(uid);
    return { collection:function(n){ return SHARED_COLS[n]?fs.collection(n):home.collection(n); } };
  }
  var unsubs=[];
  function stopAll(){ unsubs.forEach(function(f){ try{f()}catch(e){} }); unsubs=[]; }
  function resetState(){
    stopAll();
    S.db=null; S.mode=null; S.loaded={}; S.months={}; S.plans={}; S.entries=[]; S.entriesRaw=[]; S.events={}; S.rules={}; S.closes={}; S.hist={};
    S.bills={}; S.receipts={}; S.sugg={}; S.bankRules={}; S.biz={}; S.shown=null; S.settings=Object.assign({},DEF); S.drivers=['Me'];
  }
  /* sign-in screen */
  var SI={mode:'in'};
  function siMode(m){
    SI.mode=m; $('si-err').textContent='';
    $('si-go').textContent=m==='up'?'Create account':'Sign in';
    $('si-switch').textContent=m==='up'?'Already have an account? Sign in':'New here? Create an account';
    $('si-pass').setAttribute('autocomplete',m==='up'?'new-password':'current-password');
  }
  function siMsg(e){
    var c=(e&&e.code)||'';
    if(c==='auth/invalid-email') return 'That email address doesn\'t look right.';
    if(c==='auth/missing-password'||c==='auth/weak-password') return 'Use a password of at least 8 characters.';
    if(c==='auth/email-already-in-use') return 'There is already an account for this email. Sign in instead.';
    if(c==='auth/invalid-credential'||c==='auth/wrong-password'||c==='auth/user-not-found'||c==='auth/invalid-login-credentials') return 'Email or password not recognised.';
    if(c==='auth/too-many-requests') return 'Too many tries. Wait a few minutes, or reset your password.';
    if(c==='auth/network-request-failed') return 'No connection. Check your signal and try again.';
    return 'Something went wrong. Please try again.';
  }
  function wireSignin(auth){
    var lg=$('si-logo'); if(lg&&typeof LOGO160==='string') lg.src=LOGO160;
    $('si-switch').addEventListener('click',function(){ siMode(SI.mode==='up'?'in':'up'); });
    $('si-forgot').addEventListener('click',function(){
      var em=$('si-email').value.trim(); if(!em){ $('si-err').textContent='Type your email above first, then tap Forgot password.'; return; }
      auth.sendPasswordResetEmail(em).then(function(){ $('si-err').textContent=''; toast('If there is an account for '+em+', a reset link is on its way.'); })
        .catch(function(e){ $('si-err').textContent=siMsg(e); });
    });
    $('si-form').addEventListener('submit',function(ev){
      ev.preventDefault();
      var em=$('si-email').value.trim(), pw=$('si-pass').value, go=$('si-go');
      if(SI.mode==='up'&&pw.length<8){ $('si-err').textContent='Use a password of at least 8 characters.'; return; }
      go.disabled=true; $('si-err').textContent='';
      var p=SI.mode==='up'?auth.createUserWithEmailAndPassword(em,pw):auth.signInWithEmailAndPassword(em,pw);
      p.then(function(c){ if(SI.mode==='up'&&c&&c.user&&c.user.sendEmailVerification) c.user.sendEmailVerification().catch(function(){}); $('si-pass').value=''; })
       .catch(function(e){ $('si-err').textContent=siMsg(e); })
       .then(function(){ go.disabled=false; });
    });
  }
  /* bring in a backup from the old (Claude) Cab Books */
  function importBackup(file){
    if(!file||!S.db||!S.fs) return;
    var rd=new FileReader();
    rd.onload=function(){
      var data; try{ data=JSON.parse(rd.result); }catch(e){ toast('That file is not a Cab Books backup.'); return; }
      var cols=data&&data.collections; if(!cols||typeof cols!=='object'){ toast('That file is not a Cab Books backup.'); return; }
      var ops=[]; Object.keys(cols).forEach(function(c){ if(SHARED_COLS[c]||!/^[A-Za-z0-9_-]+$/.test(c)) return; var docs=cols[c]||{};
        Object.keys(docs).forEach(function(id){ if(id&&docs[id]&&typeof docs[id]==='object') ops.push([c,id,docs[id]]); }); });
      if(!ops.length){ toast('Nothing to bring in from that file.'); return; }
      var fresh=!!($('acct-rep')&&$('acct-rep').checked);
      if(!confirm(fresh?'Start fresh: everything already here (jobs, expenses, receipts, months, settings) is cleared, then '+ops.length+' records are brought in from the backup. Carry on?':'Bring in '+ops.length+' records from the backup? Records with the same number already here will be replaced.')) return;
      var i=0, done=0, home=S.fs.collection('users').doc(S.uid);
      function clearAll(){
        var cs=Object.keys(cols).filter(function(c){ return !SHARED_COLS[c]&&/^[A-Za-z0-9_-]+$/.test(c); });
        toast('Clearing what was here…');
        return Promise.all(cs.map(function(c){ return home.collection(c).get(); })).then(function(snaps){
          var refs=[]; snaps.forEach(function(sn){ sn.docs.forEach(function(d){ refs.push(d.ref); }); });
          var k=0;
          return (function del(){ if(k>=refs.length) return Promise.resolve(); var b=S.fs.batch(), n=0; while(k<refs.length&&n<400){ b.delete(refs[k++]); n++; } return b.commit().then(del); })();
        });
      }
      (fresh?clearAll():Promise.resolve()).then(function(){ next(); }).catch(function(e){ toast('Could not clear: '+((e&&e.message)||'try again')); });
      function next(){
        if(i>=ops.length){ toast('Brought in '+done+' records.'); return; }
        var b=S.fs.batch(), n=0, sz=0;
        /* receipt photos are large: keep each write well under Firestore's 10 MB request limit */
        while(i<ops.length&&n<400&&sz<6000000){ var o=ops[i++]; sz+=JSON.stringify(o[2]).length; b.set(home.collection(o[0]).doc(String(o[1])),o[2]); n++; }
        toast('Bringing in '+Math.min(i,ops.length)+' of '+ops.length+'…');
        b.commit().then(function(){ done+=n; next(); }).catch(function(e){ toast('Stopped after '+done+' records: '+((e&&e.message)||'try again')); });
      }
    };
    rd.readAsText(file);
  }
  document.addEventListener('click',function(ev){ if(ev.target&&ev.target.id==='acct-out'&&S.auth){ S.auth.signOut(); $('setovl').hidden=true; } });
  document.addEventListener('change',function(ev){ if(ev.target&&ev.target.id==='acct-imp'){ importBackup(ev.target.files&&ev.target.files[0]); ev.target.value=''; } });

  if(typeof firebase!=='undefined' && window.CB_FIREBASE && window.CB_FIREBASE.apiKey && window.CB_FIREBASE.apiKey.indexOf('PASTE')<0){
    firebase.initializeApp(window.CB_FIREBASE);
    var auth=firebase.auth(), fs=firebase.firestore();
    try{ fs.enablePersistence({synchronizeTabs:true}).catch(function(){}); }catch(e){}
    S.auth=auth; S.fs=fs; wireSignin(auth);
    auth.onAuthStateChanged(function(u){
      resetState();
      if(!u){ S.authUser=null; $('signin').hidden=false; siMode('in'); $('sync').textContent='Signed out'; renderAll(); return; }
      S.authUser=u; S.uid=u.uid; $('signin').hidden=true;
      S.syncLabel='Private to you'; $('sync').textContent='Loading…';
      S.db=driverDb(fs,u.uid); subscribe(S.db);
    });
  } else {
    $('sync').textContent='Not set up';
    document.body.insertAdjacentHTML('afterbegin','<div class="banner" style="margin:12px auto;max-width:560px">Cab Books is not connected to its database yet. Fill in firebase-config.js (see SETUP.md).</div>');
  }"""
s = s[:b0] + BOOT + s[b1:]

# subscribe(): keep each listener's unsubscribe so signing out stops them
sub0 = s.index('  function subscribe(db){')
sub1 = s.index('\n  }\n', sub0) + 4
sub = s[sub0:sub1]
sub = re.sub(r"(\n    )(db\.collection\('[a-z]+'\)\.onSnapshot\()", r"\1unsubs.push(\2", sub)
# close the push( ... ) at the end of each listener statement: each ends with "});" or ",function(){});" or ",onErr('x'));"
sub = re.sub(r"(onErr\('[a-z]+'\)\));", r"\1);", sub)
sub = re.sub(r"(\},function\(\)\{\}\));", r"\1);", sub)
s = s[:sub0] + sub + s[sub1:]

# ---------------------------------------------------------------- sanity
assert 'window.claude' not in s, 'window.claude still referenced'
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(s)

# icons from the embedded logo
m = re.search(r"LOGO160='data:image/png;base64,([A-Za-z0-9+/=]+)'", s)
if m:
    png = base64.b64decode(m.group(1))
    open(f'{OUT}/logo-160.png', 'wb').write(png)

# fare calculator map files (style, sprites, fonts, MapLibre, PMTiles) from TaxiTracker
here = os.path.dirname(os.path.abspath(__file__))
parts = sorted(glob.glob(os.path.join(here, 'map_assets_part*.txt')), key=lambda p: int(re.search(r'part(\d+)', p).group(1)))
if parts:
    b64 = ''.join(''.join(l for l in open(p, encoding='utf-8').read().splitlines() if not l.startswith('#')) for p in parts)
    with tarfile.open(fileobj=io.BytesIO(base64.b64decode(b64)), mode='r:gz') as t:
        for mem in t.getmembers():
            if mem.name.startswith('/') or '..' in mem.name.split('/'):
                raise SystemExit('unsafe path in map assets: ' + mem.name)
        t.extractall(OUT, filter='data')
    print('map files unpacked into', OUT + '/offline-map')
else:
    print('WARNING: map_assets_part*.txt not found; the fare calculator map will not load')
if not os.path.exists(f'{OUT}/cab-config.js'):
    open(f'{OUT}/cab-config.js', 'w').write(open(os.path.join(here, 'cab-config.js')).read() if os.path.exists(os.path.join(here, 'cab-config.js')) else
        "window.CB_CONFIG={geoapifyApiKey:'PASTE_GEOAPIFY_KEY_HERE'};\n")
print('built', f'{OUT}/index.html', len(s), 'bytes')
