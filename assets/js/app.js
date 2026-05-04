  /* ============================================================
     AUDIO ENGINE
  ============================================================ */
  const Audio = (() => {
    let ctx, masterGain, bgmGain;
    let bgmPlaying = false, bgmHandle = null, bgmNextTime = 0;
    let musicEnabled = true;

    const NOTE = {
      C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
      C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,B5:987.77,C6:1046.50,
      R:0
    };

    // Melody: [freq, beats]  BPM=125
    const MELODY = [
      [NOTE.E5,1],[NOTE.G5,1],[NOTE.A5,1],[NOTE.G5,1],
      [NOTE.E5,2],[NOTE.C5,2],
      [NOTE.G4,1],[NOTE.A4,1],[NOTE.C5,1],[NOTE.A4,1],
      [NOTE.G4,4],
      [NOTE.A5,1],[NOTE.G5,1],[NOTE.E5,1],[NOTE.D5,1],
      [NOTE.E5,2],[NOTE.C5,1],[NOTE.R,1],
      [NOTE.D5,1],[NOTE.E5,1],[NOTE.G5,1],[NOTE.E5,1],
      [NOTE.C5,2],[NOTE.R,2],
      [NOTE.C5,1],[NOTE.E5,1],[NOTE.G5,1],[NOTE.A5,1],
      [NOTE.C6,2],[NOTE.A5,2],
      [NOTE.G5,1],[NOTE.E5,1],[NOTE.D5,1],[NOTE.E5,1],
      [NOTE.C5,4]
    ];

    const BASS = [
      [NOTE.C4,2],[NOTE.G4,2],[NOTE.A4,2],[NOTE.E4,2],
      [NOTE.C4,2],[NOTE.G4,2],[NOTE.F4,2],[NOTE.G4,2],
      [NOTE.A4,2],[NOTE.E4,2],[NOTE.F4,2],[NOTE.G4,2],
      [NOTE.C4,2],[NOTE.G4,2],[NOTE.C4,4]
    ];

    const BEAT = 60/125;
    const MELODY_DUR = MELODY.reduce((s,[,b])=>s+b*BEAT,0);

    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(err => console.error('Audio context resume failed:', err));
      }
      masterGain = ctx.createGain(); masterGain.gain.value = 0.28;
      masterGain.connect(ctx.destination);
      bgmGain = ctx.createGain(); bgmGain.gain.value = 0.7;
      bgmGain.connect(masterGain);
    }

    function playNote(freq,start,dur,vol=0.1,type='square',dest=null) {
      if (!ctx||freq<=0) return;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(vol,start+0.01);
      g.gain.setValueAtTime(vol,start+dur-0.025);
      g.gain.linearRampToValueAtTime(0,start+dur);
      osc.connect(g);
      g.connect(dest||masterGain);
      osc.start(start);
      osc.stop(start+dur+0.05);
    }

    function scheduleLoop(startT) {
      let t = startT;
      MELODY.forEach(([f,b]) => { playNote(f,t,b*BEAT*0.88,0.07,'square',bgmGain); t+=b*BEAT; });
      t = startT;
      BASS.forEach(([f,b]) => { playNote(f,t,b*BEAT*0.75,0.04,'triangle',bgmGain); t+=b*BEAT; });
    }

    function scheduleBGM() {
      if (!bgmPlaying) return;
      const AHEAD = 0.4;
      while (bgmNextTime < ctx.currentTime + AHEAD) {
        scheduleLoop(bgmNextTime);
        bgmNextTime += MELODY_DUR;
      }
      bgmHandle = setTimeout(scheduleBGM, AHEAD*500);
    }

    function startBGM() {
      init();
      if (!musicEnabled||bgmPlaying) return;
      bgmPlaying = true;
      bgmNextTime = ctx.currentTime + 0.15;
      scheduleBGM();
    }

    function stopBGM() {
      bgmPlaying = false;
      if (bgmHandle) clearTimeout(bgmHandle);
      if (bgmGain) {
        bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime+0.3);
        setTimeout(()=>{ if(bgmGain) bgmGain.gain.value=0.7; },400);
      }
    }

    function playBomb() {
      init();
      const t = ctx.currentTime;
      // fuse beeps
      [440,554,659,880].forEach((f,i)=>{
        playNote(f,t+i*0.12,0.1,0.18,'square');
      });
      // white noise explosion
      const bufLen = Math.floor(ctx.sampleRate*1.8);
      const buf = ctx.createBuffer(1,bufLen,ctx.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<bufLen;i++) data[i]=(Math.random()*2-1);
      const ns = ctx.createBufferSource(); ns.buffer=buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0,t+0.5);
      ng.gain.linearRampToValueAtTime(0.35,t+0.55);
      ng.gain.linearRampToValueAtTime(0,t+2);
      const flt = ctx.createBiquadFilter(); flt.type='lowpass';
      flt.frequency.setValueAtTime(800,t+0.5);
      flt.frequency.linearRampToValueAtTime(150,t+2);
      ns.connect(flt); flt.connect(ng); ng.connect(masterGain);
      ns.start(t+0.5); ns.stop(t+2.1);
      // low boom
      playNote(55,t+0.5,1.0,0.45,'sine');
      playNote(80,t+0.5,0.7,0.3,'sine');
    }

    function playBlip() {
      init();
      const t = ctx.currentTime;
      playNote(880,t,0.07,0.12,'square');
    }

    function playSuccess() {
      init();
      const t = ctx.currentTime;
      [523,659,784,1047].forEach((f,i)=> playNote(f,t+i*0.1,0.12,0.1,'square'));
    }

    function unlockAudio() {
      init();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(err => console.error('Audio unlock failed:', err));
      }
    }

    function toggleMusic() {
      musicEnabled = !musicEnabled;
      if (musicEnabled) startBGM();
      else stopBGM();
      return musicEnabled;
    }

    return { startBGM, stopBGM, playBomb, playBlip, playSuccess, toggleMusic, init,
             isMusicEnabled: ()=>musicEnabled, unlockAudio };
  })();

  /* ============================================================
     TASKS
  ============================================================ */
  const TASKS = [
    // DANCE / BUST A JIVE
    { cat:'🕺 BUST A JIVE', text:'{P} has 15 seconds to bust their BEST dance move. Everyone votes — if you get majority approval, give out 2 sips!' },
    { cat:'🕺 BUST A JIVE', text:'Dance battle! {P} vs {P2} right now. Everyone else is the jury. Loser of the crowd vote drinks 2!' },
    { cat:'🕺 BUST A JIVE', text:'{P} must do the robot every single time someone says the word "drink" for the next 3 rounds.' },
    { cat:'🕺 BUST A JIVE', text:'Air band time! {P} picks a song in their head and air-plays a full 20 seconds. No stopping!' },
    { cat:'🕺 BUST A JIVE', text:'{P} teaches everyone one dance move right now. If anyone can copy it perfectly, {P} drinks!' },
    { cat:'🕺 BUST A JIVE', text:'Freeze dance! {P} starts dancing. When they randomly stop, everyone must freeze. Last to freeze drinks!' },
    { cat:'🕺 BUST A JIVE', text:'{P} must moonwalk across the room and back. No laughing allowed — laughers drink!' },
    { cat:'🕺 BUST A JIVE', text:'Vibe check! {P} has 30 seconds to do their best disco impression. Group scores it out of 10.' },
    { cat:'🕺 BUST A JIVE', text:'Silent music video! {P} performs a famous music video with no sound. Group gets 3 guesses. No correct guess = {P} drinks 2.' },
    { cat:'🕺 BUST A JIVE', text:'Dance resume! {P} must demonstrate their club dance, wedding dance, kitchen dance, and "pretending to know the lyrics" dance.' },
    { cat:'🕺 BUST A JIVE', text:'Choreo chain! Starting with {P}, everyone adds one tiny dance move. {P} must perform the full combo at the end or drink 2.' },
    { cat:'🕺 BUST A JIVE', text:'Signature walk! {P} does a dramatic entrance across the room while everyone makes the soundtrack. Best entrance gets to give out 2 sips.' },
    { cat:'🕺 BUST A JIVE', text:'TikTok audit! {P} teaches the group the last dance trend they remember. If nobody can follow it, {P} drinks 1.' },
    { cat:'🕺 BUST A JIVE', text:'Slow-mo scene! {P} and {P2} act out a dramatic dance-floor moment in slow motion. Group decides who committed harder.' },
    // SPOTIFY
    { cat:'🎧 SPOTIFY DAYLIST', text:'DAYLIST DROP! {P}, open Spotify right now and read your Daylist title out loud. If it’s chaotic or unhinged, everyone drinks!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'Predict it! Everyone guesses what {P}’s current Spotify Daylist title says. {P} checks and reveals. Wrong guessers drink!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'{P2} has to describe {P}’s music vibe in exactly 3 words. If {P} agrees with all 3, {P2} is spared. Otherwise {P2} drinks!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'Mood match: {P} reads their Daylist title. Group decides if it actually matches their energy tonight. Jury vote — guilty = 2 sips!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Hot take! What is {P}’s #1 Spotify artist this year? Everyone writes their guess at the same time, then reveal. Wrong guessers drink!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'{P} hums the first 5 seconds of their most played song this month. Group has 3 guesses. No clues = 2 sips to {P}!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Most embarrassing liked song! {P} opens Spotify and reads their most embarrassing liked song title. Then everyone shares one!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'{P} opens Spotify and reads their last 3 recently played songs out loud. Group reacts with a vibe rating: bop / mid / flop.' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Wrapped preview! Everyone guesses {P}’s top genre. {P} checks and reveals. Most wrong guess = 2 sips!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Guilty pleasures! {P} admits to one song they’ve listened to 3+ times this week that they’re ashamed of. No judgement... or drink!' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Playlist autopsy! {P} opens their most recently edited playlist and reads the title. Group guesses the emotional damage behind it.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'First search confession! {P} taps the Spotify search bar and reads the first thing suggested. If it exposes a phase, {P} drinks 2.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Skip or save! {P} names one song they always skip and one song they would save from a burning playlist. Group judges the taste.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Lyric lie detector! {P} reads one lyric from a song they love. Everyone guesses the song. Wrong guessers drink 1.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Main character song! The group chooses the song that would play when {P} enters a movie scene. {P} can accept it or drink 2.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Queue confession! {P} reads the next song in their queue or recently played list. If the group says it kills the vibe, {P} drinks.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Album cover pose! {P} recreates the pose from any album cover in their library. Group gets 3 guesses or {P} gives out 2 sips.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Aux court! {P} argues why they deserve the aux for the next party. Group votes yes or no. No = {P} drinks 2.' },
    // NOTES APP
    { cat:'📝 NOTES APP', text:'READ IT OUT! {P} must open their notes app and read their most recent note out loud. No skipping. No edits. Raw.' },
    { cat:'📝 NOTES APP', text:'Notes roulette! Everyone reads their second-to-last note out loud. Most unhinged note wins — that person gives out 3 sips.' },
    { cat:'📝 NOTES APP', text:'{P} has a secret note. Time to share it... or drink 3 and keep the mystery.' },
    { cat:'📝 NOTES APP', text:'Shopping list confession! {P} reads their current shopping list. If anything on it is weird or unexpected, {P} drinks!' },
    { cat:'📝 NOTES APP', text:'Live dictation! {P} dictates a sentence to {P2}, who types it into their notes app and reads it back dramatically.' },
    { cat:'📝 NOTES APP', text:'{P} reads the note they wrote most recently at 11pm or later. If they can’t find one, they drink 2.' },
    { cat:'📝 NOTES APP', text:'Longest note! Whoever has the longest note in their notes app right now reads the first 3 lines. {P} judges if it’s giving.' },
    { cat:'📝 NOTES APP', text:'Search your notes for "love". {P} reads the safest result or drinks 2 to keep the archive sealed.' },
    { cat:'📝 NOTES APP', text:'To-do list roast! {P} reads one unfinished task from their notes. Anyone who has also been avoiding something drinks 1.' },
    { cat:'📝 NOTES APP', text:'Note title only! {P} reads the weirdest note title they can find. Group invents what the note says before {P} reveals one line.' },
    { cat:'📝 NOTES APP', text:'Future note! {P} writes one sentence in their notes addressed to themselves one year from now, then reads it out loud.' },
    { cat:'📝 NOTES APP', text:'Draft a prophecy! {P} opens notes and writes a one-line prediction for the group tonight. If it comes true, everyone drinks later.' },
    { cat:'📝 NOTES APP', text:'Notes search roulette! The group picks a random word. {P} searches it in notes. Any result = read one line; no result = drink 1.' },
    // SNAPCHAT / SOCIAL
    { cat:'👻 SNAP DARE', text:'SNAP DARE! {P} hands their phone to {P2} who posts ONE story on their Snapchat right now. Zero veto. Zero preview.' },
    { cat:'👻 SNAP DARE', text:'{P} lets the group choose a filter and sends a snap to someone they haven’t spoken to in 6+ months.' },
    { cat:'👻 SNAP DARE', text:'Group selfie time! {P} is the photographer. Make it iconic. It goes on someone’s story.' },
    { cat:'👻 SNAP DARE', text:'📸 Boomerang time! {P} does a 10-second boomerang that the group choreographs. Post-worthy or drink 2!' },
    { cat:'👻 SNAP DARE', text:'{P} changes their WhatsApp profile photo to one chosen by the group (from their camera roll) for the next hour. No cheating!' },
    { cat:'👻 SNAP DARE', text:'Story takeover! {P} hands their phone to {P2} for exactly 90 seconds to post one Instagram story. Phone back at the bell.' },
    // QUESTION MASTER
    { cat:'👑 QUESTION MASTER', text:'QUESTION MASTER! {P} is now the Question Master. Anyone who answers a yes/no question from {P} must drink 1. Power lasts 3 rounds!' },
    { cat:'👑 QUESTION MASTER', text:'Hot seat! {P} sits in the hot seat. Everyone takes turns asking one rapid-fire question. First hesitation = drink. No passes!' },
    { cat:'👑 QUESTION MASTER', text:'Truth bomb: {P} asks {P2} any question in the world. They must answer honestly or drink 3. No topic is off limits (keep it fun!).' },
    { cat:'👑 QUESTION MASTER', text:'Would you rather? {P} asks the group a "would you rather" question. The minority opinion drinks 1.' },
    { cat:'👑 QUESTION MASTER', text:'20 questions! {P} thinks of a famous person. Everyone else gets 5 yes/no questions total to guess who it is. Wrong = {P} gives out 2 sips!' },
    { cat:'👑 QUESTION MASTER', text:'Fortune teller! {P} makes a prediction about each player’s next year. Group votes on most accurate prediction. Winner gives out 3 sips!' },
    { cat:'👑 QUESTION MASTER', text:'Rapid fire! {P} has 30 seconds to answer as many questions from the group as possible. Less than 5 correct = drink 2!' },
    // IMPRESSIONS
    { cat:'🎭 IMPRESSIONS', text:'{P} does their best impression of a famous celebrity or TV character. Group guesses who it is. Failed guess after 3 attempts = {P} drinks!' },
    { cat:'🎭 IMPRESSIONS', text:'{P} must speak only in questions for the next 2 rounds. Any statement = drink 1. Go!' },
    { cat:'🎭 IMPRESSIONS', text:'Freestyle rap! {P} raps for 20 seconds about a topic the group chooses. Group rates it: fire 🔥 or trash 🗑️' },
    { cat:'🎭 IMPRESSIONS', text:'{P} speaks in an accent chosen by the group until the next round. Breaking character = drink 1 per slip.' },
    { cat:'🎭 IMPRESSIONS', text:'{P} explains what happened in the last episode of a show they’re currently watching. No title allowed. Group guesses the show!' },
    { cat:'🎭 IMPRESSIONS', text:'Name that tune! {P} hums a song for 10 seconds. If {P2} guesses it, {P2} gives out 2 sips. If not, {P} drinks 1.' },
    { cat:'🎭 IMPRESSIONS', text:'{P} must narrate the last 5 minutes of the evening in the voice of a nature documentary presenter. Go.' },
    // PHONE DARES
    { cat:'📱 PHONE DARE', text:'Phone swap! {P} and {P2} swap phones for exactly 60 seconds. No looking at messages. No apps. Just vibes.' },
    { cat:'📱 PHONE DARE', text:'{P} turns their phone volume up to full and reads their last 3 notifications out loud to everyone.' },
    { cat:'📱 PHONE DARE', text:'{P} lets {P2} send one completely harmless text to a contact they choose. {P2} picks the recipient, group writes the message.' },
    { cat:'📱 PHONE DARE', text:'{P} opens their camera roll. Everyone gets to see the next 5 photos that appear. Group must react out loud to each one!' },
    { cat:'📱 PHONE DARE', text:'Profile pic roulette! {P} changes their phone lock screen wallpaper to a photo chosen by the group for the rest of the evening.' },
    { cat:'📱 PHONE DARE', text:'{P} sends a voice note to someone not in the room. Group writes the script. No deviating from the script!' },
    { cat:'📱 PHONE DARE', text:'Without looking: {P} guesses how many unread notifications they have right now. Closest person in the room wins, furthest drinks 2!' },
    // CONFESSIONS & FUNNY
    { cat:'🙈 CONFESS!', text:'{P} reveals their most embarrassing autocorrect fail. Bonus sip if it was sent to the wrong person.' },
    { cat:'🙈 CONFESS!', text:'{P} shares the most recent thing that made them laugh out loud completely alone. Re-enactment required.' },
    { cat:'🙈 CONFESS!', text:'2am confession! {P} admits the last thing they googled after midnight. Read the exact search term. No paraphrasing.' },
    { cat:'🙈 CONFESS!', text:'{P} confesses which song they’ve had on repeat this week. Must hum 10 seconds of it to prove it.' },
    { cat:'🙈 CONFESS!', text:'{P} tells the group their most recent dream in full. Group rates it out of 10 for: chaos / romance / boring.' },
    // MINI GAMES
    { cat:'🎮 MINI GAME', text:'Rock Paper Scissors tournament! {P} plays everyone in the room one by one. Lose 3 times and drink. Go!' },
    { cat:'🎮 MINI GAME', text:'{P} picks a number 1–10 in their head. Everyone else guesses simultaneously. Closest guesses win, furthest drinks 2!' },
    { cat:'🎮 MINI GAME', text:'Staring contest: {P} vs {P2}. First to blink drinks 2. Group can do anything to make them blink except touch them.' },
    { cat:'🎮 MINI GAME', text:'Whisper chain! {P} whispers a sentence to the person next to them. Pass it around. What does it turn into by the end?' },
    { cat:'🎮 MINI GAME', text:'⏱ Speed round! How many times can {P} clap in 10 seconds? Everyone tries to beat their score. Last place drinks!' },
    // GROUP VIBES
    { cat:'🌈 GROUP VIBE', text:'Compliment spiral! Starting with {P}, give the next person a genuine compliment. Keep it going around the room. No repeats!' },
    { cat:'🌈 GROUP VIBE', text:'{P} writes and performs a haiku about someone in the room right now. Subject is chosen by group vote.' },
    { cat:'🌈 GROUP VIBE', text:'Emoji guess! Everyone thinks of {P}’s most used emoji. Reveal simultaneously. Anyone who matches {P}’s real answer gives out 2 sips!' },
    { cat:'🌈 GROUP VIBE', text:'Movie pitch! {P} pitches a sequel to the last film they watched in 30 seconds. Group votes: greenlit ✅ or cancelled ❌' },
    { cat:'🌈 GROUP VIBE', text:'Replace all words in a song chorus with food items. {P} performs it. Group guesses the original song!' },
    { cat:'🌈 GROUP VIBE', text:'{P} gives everyone in the group a unique nickname for the rest of the game. If anyone forgets to use the nicknames, they drink!' },
    // DEEP / EMOTIONAL
    { cat:'💘 DEEP CUT', text:'{P}, what is a compliment you still remember? Answer honestly or drink 2.' },
    { cat:'💘 DEEP CUT', text:'{P}, what is something you pretend not to care about but secretly do? Keep it real or drink 2.' },
    { cat:'💘 DEEP CUT', text:'The group tells {P} one thing they bring to the room that they probably underestimate. {P} picks the best answer to give out 2 sips.' },
    { cat:'💘 DEEP CUT', text:'{P}, name one tiny moment from this year that made you feel properly happy. No jokes for 10 seconds or the jokers drink.' },
    { cat:'💘 DEEP CUT', text:'{P}, which version of you would be proud of tonight’s version of you? Answer or drink 2.' },
    { cat:'💘 DEEP CUT', text:'{P}, what is one thing you wish people asked you about more often? Anyone who asks a good follow-up gives out 1 sip.' },
    { cat:'💘 DEEP CUT', text:'{P}, who here would you call if you needed an honest answer? Pick someone and say why, or drink 2.' },
    // CELEB CRUSHES
    { cat:'😍 CELEB CRUSH', text:'{P}, reveal your current celebrity crush. Group guesses before you answer; correct guessers give out 2 sips.' },
    { cat:'😍 CELEB CRUSH', text:'Childhood crush audit! {P} names their first celebrity crush. If the group says it makes sense, {P} drinks 1.' },
    { cat:'😍 CELEB CRUSH', text:'{P2} guesses {P}’s celebrity type in one sentence. {P} confirms or denies. Wrong read = {P2} drinks.' },
    { cat:'😍 CELEB CRUSH', text:'Red carpet ranking! {P} names 3 celebrity crushes and ranks them. Group may challenge one placement.' },
    { cat:'😍 CELEB CRUSH', text:'The group chooses which celebrity would have the biggest crush on {P}. {P} accepts the fantasy or drinks 2.' },
    { cat:'😍 CELEB CRUSH', text:'{P}, name a celebrity everyone finds hot but you simply do not get. Anyone offended drinks 1.' },
    // CASTING CALL
    { cat:'🎬 CASTING CALL', text:'Movie of {P}’s life: the group casts the actor who would play {P}. {P} can approve or demand a recast and drink 1.' },
    { cat:'🎬 CASTING CALL', text:'{P} casts everyone in a heist movie: mastermind, getaway driver, distraction, villain, and person who ruins the plan.' },
    { cat:'🎬 CASTING CALL', text:'{P}, who would play {P2} in a rom-com and what would the movie be called? {P2} rates the casting.' },
    { cat:'🎬 CASTING CALL', text:'Biopic trailer! {P} narrates the trailer for their own movie in 20 seconds. Group chooses the actor and the soundtrack.' },
    { cat:'🎬 CASTING CALL', text:'Reality show casting! The group assigns {P} a role: fan favourite, villain, chaos edit, narrator, or early exit.' },
    { cat:'🎬 CASTING CALL', text:'{P} casts the whole group in a murder mystery. The accused person drinks 1; the detective gives out 1.' },
    // MOST LIKELY TO
    { cat:'🏆 MOST LIKELY', text:'Most likely to accidentally become famous? Everyone points. Most votes drinks 1 and gives an acceptance speech.' },
    { cat:'🏆 MOST LIKELY', text:'Most likely to fall in love on holiday? Everyone votes. Winner explains their strategy or drinks 2.' },
    { cat:'🏆 MOST LIKELY', text:'Most likely to send a voice note longer than 5 minutes? Everyone votes. Winner must send a 5-second acceptance speech.' },
    { cat:'🏆 MOST LIKELY', text:'Most likely to survive a reality show? Everyone votes. Winner gives out 2 sips; runner-up drinks 1.' },
    { cat:'🏆 MOST LIKELY', text:'Most likely to leave a party with a brand new best friend? Everyone votes. Winner tells us their opening line.' },
    { cat:'🏆 MOST LIKELY', text:'Most likely to say "one drink" and mean the whole night? Everyone points. Winner drinks 2.' },
    // COCKTAIL ENERGY
    { cat:'🍸 COCKTAIL ENERGY', text:'What cocktail would {P} be? The group decides the drink, garnish, and chaotic name. {P} rates it out of 10.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Build {P} as a cocktail: one spirit, one mixer, one garnish, one red flag. Best recipe gives out 2 sips.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Who in the room is an espresso martini? Everyone points. Winner must explain their caffeine-to-drama ratio.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'{P}, assign {P2} a cocktail and explain the vibe. If {P2} agrees, {P} gives out 2 sips; if not, {P} drinks.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'The group names a cocktail that matches tonight’s energy. {P} must make a toast using that cocktail name.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Mocktail mode! {P} invents a non-alcoholic drink named after someone here. The chosen person drinks 1 and reviews it.' },
    // PUB QUIZ
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: What planet is known as the Red Planet? Answer: Mars. Correct guess gives out 1 sip; wrong guess drinks 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: How many colours are in a rainbow? Answer: 7. Right = give out 1; wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: What is the chemical symbol for gold? Answer: Au. Correct answer gives out 2 sips; wrong answers drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: In Mean Girls, what date is "Mean Girls Day"? Answer: October 3. Wrong answers drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: Which artist released the album SOUR? Answer: Olivia Rodrigo. Right = give out 2; wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: What country is tequila originally from? Answer: Mexico. Wrong answers drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: Which movie features the line "I’m the king of the world!"? Answer: Titanic. Wrong answers drink.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks the group: What is the largest ocean on Earth? Answer: Pacific Ocean. Correct answer gives out 2 sips.' },
  ];

  const TWO_PLAYER_TASKS = [
    // DANCE / BUST A JIVE
    { cat:'🕺 BUST A JIVE', text:'{P} has 15 seconds to bust their BEST dance move. {P2} scores it out of 10. 7+ means {P} gives out 2 sips, otherwise {P} drinks 2!' },
    { cat:'🕺 BUST A JIVE', text:'Dance battle! {P} vs {P2} right now. Both perform for 10 seconds. Decide the winner together or both drink 1.' },
    { cat:'🕺 BUST A JIVE', text:'{P} must do the robot every single time {P2} says the word "drink" for the next 3 rounds.' },
    { cat:'🕺 BUST A JIVE', text:'Air band time! {P} picks a song in their head and air-plays a full 20 seconds. If {P2} guesses the vibe, {P} drinks 1. If not, {P2} drinks 1.' },
    { cat:'🕺 BUST A JIVE', text:'{P} teaches {P2} one dance move right now. If {P2} copies it perfectly, {P} drinks. If not, {P2} drinks!' },
    { cat:'🕺 BUST A JIVE', text:'Freeze dance! {P} dances while {P2} waits to shout FREEZE. If {P} freezes instantly, {P2} drinks. If not, {P} drinks!' },
    { cat:'🕺 BUST A JIVE', text:'{P} must moonwalk across the room and back. If {P2} laughs, {P2} drinks. If {P2} stays serious, {P} drinks!' },
    { cat:'🕺 BUST A JIVE', text:'Vibe check! {P} has 30 seconds to do their best disco impression. {P2} gives a one-word review and awards or assigns 2 sips.' },
    { cat:'🕺 BUST A JIVE', text:'Silent music video! {P} performs a famous music video with no sound. {P2} gets 3 guesses. No correct guess = {P} drinks 2.' },
    { cat:'🕺 BUST A JIVE', text:'Dance resume! {P} demonstrates their club dance, wedding dance, kitchen dance, and "pretending to know the lyrics" dance for {P2}.' },
    { cat:'🕺 BUST A JIVE', text:'Choreo chain! {P} makes one dance move, {P2} adds one, then {P} performs both. Mess it up and drink 1.' },
    { cat:'🕺 BUST A JIVE', text:'Signature walk! {P} does a dramatic entrance while {P2} makes the soundtrack. If either breaks, they drink.' },
    { cat:'🕺 BUST A JIVE', text:'TikTok audit! {P} teaches {P2} the last dance trend they remember. If {P2} cannot follow it, {P2} drinks; bad teaching = {P} drinks.' },
    // SPOTIFY
    { cat:'🎧 SPOTIFY DAYLIST', text:'DAYLIST DROP! {P}, open Spotify right now and read your Daylist title out loud. {P2} decides: chaotic = {P2} drinks, boring = {P} drinks!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'Predict it! {P2} guesses what {P}’s current Spotify Daylist title says. {P} checks and reveals. Wrong guess = {P2} drinks!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'{P2} has to describe {P}’s music vibe in exactly 3 words. If {P} agrees with all 3, {P2} is spared. Otherwise {P2} drinks!' },
    { cat:'🎧 SPOTIFY DAYLIST', text:'Mood match: {P} reads their Daylist title. {P2} decides if it matches their energy tonight. Guilty = {P} drinks 2, innocent = {P2} drinks 1!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Hot take! {P2} guesses {P}’s #1 Spotify artist this year. {P} reveals the truth. Wrong guess = {P2} drinks, correct guess = {P} drinks 2!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'{P} hums the first 5 seconds of their most played song this month. {P2} gets 3 guesses. No correct guess = 2 sips to {P}!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Most embarrassing liked song! {P} opens Spotify and reads their most embarrassing liked song title. Then {P2} shares one too.' },
    { cat:'🎧 SPOTIFY ARTIST', text:'{P} opens Spotify and reads their last 3 recently played songs out loud. {P2} gives each one a vibe rating: bop / mid / flop.' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Wrapped preview! {P2} guesses {P}’s top genre. {P} checks and reveals. Wrong guess = {P2} drinks 2, correct guess = {P} drinks 2!' },
    { cat:'🎧 SPOTIFY ARTIST', text:'Guilty pleasures! {P} admits to one song they’ve listened to 3+ times this week that they’re ashamed of. {P2} may ask one follow-up.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Playlist autopsy! {P} opens their most recently edited playlist and reads the title. {P2} guesses the emotional damage behind it.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'First search confession! {P} taps the Spotify search bar and reads the first thing suggested. If {P2} says it exposes a phase, {P} drinks 2.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Skip or save! {P} names one song they always skip and one song they would save from a burning playlist. {P2} judges the taste.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Lyric lie detector! {P} reads one lyric from a song they love. {P2} guesses the song. Wrong guess = {P2} drinks 1.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Main character song! {P2} chooses the song that would play when {P} enters a movie scene. {P} can accept it or drink 2.' },
    { cat:'🎧 SPOTIFY ROULETTE', text:'Aux court! {P} argues why they deserve the aux for the next party. {P2} votes yes or no. No = {P} drinks 2.' },
    // NOTES APP
    { cat:'📝 NOTES APP', text:'READ IT OUT! {P} must open their notes app and read their most recent note out loud. No skipping. No edits. Raw.' },
    { cat:'📝 NOTES APP', text:'Notes roulette! {P} and {P2} both read their second-to-last note out loud. The weirder note gives out 3 sips.' },
    { cat:'📝 NOTES APP', text:'{P} has a secret note. Time to share it with {P2}... or drink 3 and keep the mystery.' },
    { cat:'📝 NOTES APP', text:'Shopping list confession! {P} reads their current shopping list. If {P2} thinks anything on it is weird or unexpected, {P} drinks!' },
    { cat:'📝 NOTES APP', text:'Live dictation! {P} dictates a sentence to {P2}, who types it into their notes app and reads it back dramatically.' },
    { cat:'📝 NOTES APP', text:'{P} reads the note they wrote most recently at 11pm or later. If they can’t find one, they drink 2.' },
    { cat:'📝 NOTES APP', text:'Longest note! {P} and {P2} compare note lengths. Whoever has the longest note reads the first 3 lines and gives out 2 sips.' },
    { cat:'📝 NOTES APP', text:'Search your notes for "love". {P} reads the safest result to {P2} or drinks 2 to keep the archive sealed.' },
    { cat:'📝 NOTES APP', text:'To-do list roast! {P} reads one unfinished task from their notes. If {P2} has also been avoiding something, {P2} drinks 1.' },
    { cat:'📝 NOTES APP', text:'Note title only! {P} reads the weirdest note title they can find. {P2} invents what the note says before {P} reveals one line.' },
    { cat:'📝 NOTES APP', text:'Future note! {P} writes one sentence in their notes addressed to themselves one year from now, then reads it to {P2}.' },
    { cat:'📝 NOTES APP', text:'Notes search roulette! {P2} picks a random word. {P} searches it in notes. Any result = read one line; no result = drink 1.' },
    // SNAPCHAT / SOCIAL
    { cat:'👻 SNAP DARE', text:'SNAP DARE! {P} hands their phone to {P2} who posts ONE harmless story on their Snapchat right now. Zero veto. Zero preview.' },
    { cat:'👻 SNAP DARE', text:'{P2} chooses a filter and {P} sends a snap to someone they haven’t spoken to in 6+ months.' },
    { cat:'👻 SNAP DARE', text:'Selfie time! {P} is the photographer and {P2} directs the pose. Make it iconic. Post it or both drink 1.' },
    { cat:'👻 SNAP DARE', text:'📸 Boomerang time! {P} does a 10-second boomerang choreographed by {P2}. Post-worthy or drink 2!' },
    { cat:'👻 SNAP DARE', text:'{P} changes their WhatsApp profile photo to one chosen by {P2} from their camera roll for the next hour. No cheating!' },
    { cat:'👻 SNAP DARE', text:'Story takeover! {P} hands their phone to {P2} for exactly 90 seconds to post one harmless Instagram story. Phone back at the bell.' },
    // QUESTION MASTER
    { cat:'👑 QUESTION MASTER', text:'QUESTION MASTER! {P} is now the Question Master. If {P2} answers a yes/no question from {P}, {P2} drinks 1. Power lasts 3 rounds!' },
    { cat:'👑 QUESTION MASTER', text:'Hot seat! {P2} asks {P} rapid-fire questions for 30 seconds. First hesitation = {P} drinks. No passes!' },
    { cat:'👑 QUESTION MASTER', text:'Truth bomb: {P} asks {P2} any question in the world. They must answer honestly or drink 3. No topic is off limits (keep it fun!).' },
    { cat:'👑 QUESTION MASTER', text:'Would you rather? {P} asks {P2} a "would you rather" question. If {P2} refuses to choose, they drink 1.' },
    { cat:'👑 QUESTION MASTER', text:'20 questions! {P} thinks of a famous person. {P2} gets 5 yes/no questions total to guess who it is. Wrong = {P} gives out 2 sips!' },
    { cat:'👑 QUESTION MASTER', text:'Fortune teller! {P} makes a prediction about {P2}’s next year. If {P2} accepts the prophecy, {P2} drinks. If not, {P} drinks!' },
    { cat:'👑 QUESTION MASTER', text:'Rapid fire! {P} has 30 seconds to answer as many questions from {P2} as possible. Less than 5 answers = drink 2!' },
    // IMPRESSIONS
    { cat:'🎭 IMPRESSIONS', text:'{P} does their best impression of a famous celebrity or TV character. {P2} gets 3 guesses. Failed guess = {P} drinks!' },
    { cat:'🎭 IMPRESSIONS', text:'{P} must speak only in questions for the next 2 rounds. Any statement spotted by {P2} = drink 1. Go!' },
    { cat:'🎭 IMPRESSIONS', text:'Freestyle rap! {P} raps for 20 seconds about a topic {P2} chooses. {P2} rates it: fire 🔥 or trash 🗑️' },
    { cat:'🎭 IMPRESSIONS', text:'{P} speaks in an accent chosen by {P2} until the next round. Breaking character = drink 1 per slip.' },
    { cat:'🎭 IMPRESSIONS', text:'{P} explains what happened in the last episode of a show they’re currently watching. No title allowed. {P2} guesses the show!' },
    { cat:'🎭 IMPRESSIONS', text:'Name that tune! {P} hums a song for 10 seconds. If {P2} guesses it, {P2} gives out 2 sips. If not, {P} drinks 1.' },
    { cat:'🎭 IMPRESSIONS', text:'{P} must narrate the last 5 minutes of the evening in the voice of a nature documentary presenter while {P2} acts it out.' },
    // PHONE DARES
    { cat:'📱 PHONE DARE', text:'Phone swap! {P} and {P2} swap phones for exactly 60 seconds. No looking at messages. No apps. Just vibes.' },
    { cat:'📱 PHONE DARE', text:'{P} turns their phone volume up to full and reads their last 3 notifications out loud to {P2}.' },
    { cat:'📱 PHONE DARE', text:'{P} lets {P2} send one completely harmless text to a contact they choose. {P2} picks the recipient and writes the message.' },
    { cat:'📱 PHONE DARE', text:'{P} opens their camera roll. {P2} gets to see the next 5 photos that appear and must react out loud to each one!' },
    { cat:'📱 PHONE DARE', text:'Profile pic roulette! {P} changes their phone lock screen wallpaper to a photo chosen by {P2} for the rest of the evening.' },
    { cat:'📱 PHONE DARE', text:'{P} sends a voice note to someone not here. {P2} writes the script. No deviating from the script!' },
    { cat:'📱 PHONE DARE', text:'Without looking: {P} guesses how many unread notifications they have right now. {P2} guesses too. Furthest from the truth drinks 2!' },
    // CONFESSIONS & FUNNY
    { cat:'🙈 CONFESS!', text:'{P} reveals their most embarrassing autocorrect fail to {P2}. Bonus sip if it was sent to the wrong person.' },
    { cat:'🙈 CONFESS!', text:'{P} shares the most recent thing that made them laugh out loud completely alone. Re-enactment required for {P2}.' },
    { cat:'🙈 CONFESS!', text:'2am confession! {P} admits the last thing they googled after midnight. Read the exact search term. No paraphrasing.' },
    { cat:'🙈 CONFESS!', text:'{P} confesses which song they’ve had on repeat this week. Must hum 10 seconds of it to prove it.' },
    { cat:'🙈 CONFESS!', text:'{P} tells {P2} their most recent dream in full. {P2} rates it out of 10 for: chaos / romance / boring.' },
    // MINI GAMES
    { cat:'🎮 MINI GAME', text:'Rock Paper Scissors duel! {P} and {P2} play best of 5. Loser drinks 2. Go!' },
    { cat:'🎮 MINI GAME', text:'{P} picks a number 1–10 in their head. {P2} gets one guess. Exact guess = {P} drinks 2, otherwise {P2} drinks 1.' },
    { cat:'🎮 MINI GAME', text:'Staring contest: {P} vs {P2}. First to blink drinks 2. No touching.' },
    { cat:'🎮 MINI GAME', text:'Whisper challenge! {P} whispers a ridiculous sentence once. {P2} repeats what they heard. If it changes, both drink 1.' },
    { cat:'🎮 MINI GAME', text:'⏱ Speed round! How many times can {P} clap in 10 seconds? {P2} tries to beat the score. Loser drinks!' },
    // GROUP VIBES
    { cat:'🌈 GROUP VIBE', text:'Compliment swap! {P} gives {P2} a genuine compliment, then {P2} gives one back. Weak compliments drink 1.' },
    { cat:'🌈 GROUP VIBE', text:'{P} writes and performs a haiku about {P2} right now. If {P2} laughs, {P2} drinks. If not, {P} drinks.' },
    { cat:'🌈 GROUP VIBE', text:'Emoji guess! {P2} guesses {P}’s most used emoji. Correct guess = {P} drinks 2. Wrong guess = {P2} drinks 1.' },
    { cat:'🌈 GROUP VIBE', text:'Movie pitch! {P} pitches a sequel to the last film they watched in 30 seconds. {P2} decides: greenlit ✅ or cancelled ❌' },
    { cat:'🌈 GROUP VIBE', text:'Replace all words in a song chorus with food items. {P} performs it. {P2} guesses the original song!' },
    { cat:'🌈 GROUP VIBE', text:'{P} gives {P2} a unique nickname for the rest of the game. If {P2} forgets to use it, they drink!' },
    // DEEP / EMOTIONAL
    { cat:'💘 DEEP CUT', text:'{P}, what is a compliment you still remember? Answer honestly to {P2} or drink 2.' },
    { cat:'💘 DEEP CUT', text:'{P}, what is something you pretend not to care about but secretly do? Keep it real or drink 2.' },
    { cat:'💘 DEEP CUT', text:'{P2} tells {P} one thing they bring to the room that they probably underestimate. Weak answer = {P2} drinks 1.' },
    { cat:'💘 DEEP CUT', text:'{P}, name one tiny moment from this year that made you feel properly happy. No jokes for 10 seconds.' },
    { cat:'💘 DEEP CUT', text:'{P}, what is one thing you wish people asked you about more often? {P2} gets one good follow-up.' },
    { cat:'💘 DEEP CUT', text:'{P}, would you call {P2} for advice, distraction, or emergency backup? Explain or drink 2.' },
    // CELEB CRUSHES
    { cat:'😍 CELEB CRUSH', text:'{P}, reveal your current celebrity crush. {P2} guesses before you answer; correct guess = {P2} gives out 2 sips.' },
    { cat:'😍 CELEB CRUSH', text:'Childhood crush audit! {P} names their first celebrity crush. If {P2} says it makes sense, {P} drinks 1.' },
    { cat:'😍 CELEB CRUSH', text:'{P2} guesses {P}’s celebrity type in one sentence. {P} confirms or denies. Wrong read = {P2} drinks.' },
    { cat:'😍 CELEB CRUSH', text:'Red carpet ranking! {P} names 3 celebrity crushes and ranks them. {P2} may challenge one placement.' },
    { cat:'😍 CELEB CRUSH', text:'{P}, name a celebrity everyone finds hot but you simply do not get. If {P2} is offended, {P2} drinks 1.' },
    // CASTING CALL
    { cat:'🎬 CASTING CALL', text:'Movie of {P}’s life: {P2} casts the actor who would play {P}. {P} can approve or demand a recast and drink 1.' },
    { cat:'🎬 CASTING CALL', text:'{P} casts {P2} in a heist movie: mastermind, getaway driver, distraction, villain, or person who ruins the plan.' },
    { cat:'🎬 CASTING CALL', text:'{P}, who would play {P2} in a rom-com and what would the movie be called? {P2} rates the casting.' },
    { cat:'🎬 CASTING CALL', text:'Biopic trailer! {P} narrates the trailer for their own movie in 20 seconds. {P2} chooses the actor and soundtrack.' },
    { cat:'🎬 CASTING CALL', text:'Reality show casting! {P2} assigns {P} a role: fan favourite, villain, chaos edit, narrator, or early exit.' },
    // MOST LIKELY TO
    { cat:'🏆 MOST LIKELY', text:'Who is more likely to accidentally become famous: {P} or {P2}? Both argue their case. Loser drinks 1.' },
    { cat:'🏆 MOST LIKELY', text:'Who is more likely to fall in love on holiday: {P} or {P2}? Pick together. Winner explains their strategy or drinks 2.' },
    { cat:'🏆 MOST LIKELY', text:'Who is more likely to send a voice note longer than 5 minutes: {P} or {P2}? Guilty party drinks 1.' },
    { cat:'🏆 MOST LIKELY', text:'Who is more likely to survive a reality show: {P} or {P2}? Winner gives out 2 sips; loser drinks 1.' },
    { cat:'🏆 MOST LIKELY', text:'Who is more likely to say "one drink" and mean the whole night: {P} or {P2}? Decide fast. Chosen person drinks 2.' },
    // COCKTAIL ENERGY
    { cat:'🍸 COCKTAIL ENERGY', text:'What cocktail would {P} be? {P2} decides the drink, garnish, and chaotic name. {P} rates it out of 10.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Build {P2} as a cocktail: one spirit, one mixer, one garnish, one red flag. {P2} reviews the recipe.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Who is more espresso martini energy: {P} or {P2}? Winner must explain their caffeine-to-drama ratio.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'{P}, assign {P2} a cocktail and explain the vibe. If {P2} agrees, {P} gives out 2 sips; if not, {P} drinks.' },
    { cat:'🍸 COCKTAIL ENERGY', text:'Mocktail mode! {P} invents a non-alcoholic drink named after {P2}. {P2} drinks 1 and reviews it.' },
    // PUB QUIZ
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: What planet is known as the Red Planet? Answer: Mars. Correct = {P2} gives out 1; wrong = {P2} drinks 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: How many colours are in a rainbow? Answer: 7. Right = give out 1; wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: What is the chemical symbol for gold? Answer: Au. Correct = {P2} gives out 2; wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: In Mean Girls, what date is "Mean Girls Day"? Answer: October 3. Wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: Which artist released the album SOUR? Answer: Olivia Rodrigo. Right = give out 2; wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: What country is tequila originally from? Answer: Mexico. Wrong = drink 1.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: Which movie features the line "I’m the king of the world!"? Answer: Titanic. Wrong = drink.' },
    { cat:'🍻 PUB QUIZ', text:'PUB QUIZ! {P} asks {P2}: What is the largest ocean on Earth? Answer: Pacific Ocean. Correct = give out 2.' },
  ];

  /* ============================================================
     PARTICLES
  ============================================================ */
  (function spawnParticles() {
    const container = document.getElementById('particles');
    const ICONS = ['✨','♥','★','🌸','💫','🪄','🦛','🎀','🌟','🌊'];
    for (let i=0; i<35; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      el.textContent = ICONS[Math.floor(Math.random()*ICONS.length)];
      el.style.left = Math.random()*100 + '%';
      el.style.fontSize = (.6 + Math.random()*.8) + 'rem';
      el.style.animationDuration = (8 + Math.random()*14) + 's';
      el.style.animationDelay   = (-Math.random()*20) + 's';
      el.style.opacity = '0';
      container.appendChild(el);
    }
  })();

  /* ============================================================
     GAME STATE
  ============================================================ */
  let players = [];
  let deck    = [];
  let round   = 0;
  let bombPos = 0;

  function categoryGroup(task) {
    return task.cat.split(' ')[0];
  }

  function shuffleTasks(tasks) {
    const remaining = [...tasks];
    const shuffled = [];
    let lastGroup = '';

    while (remaining.length) {
      const candidates = remaining
        .map((task,index) => ({ task, index }))
        .filter(({ task }) => categoryGroup(task) !== lastGroup);
      const pool = candidates.length ? candidates : remaining.map((task,index) => ({ task, index }));
      const pick = pool[Math.floor(Math.random()*pool.length)];

      shuffled.push(pick.task);
      lastGroup = categoryGroup(pick.task);
      remaining.splice(pick.index,1);
    }

    return shuffled;
  }

  function buildDeck() {
    const tasks = players.length === 2 ? TWO_PLAYER_TASKS : TASKS;
    const shuffled = shuffleTasks(tasks);
    // bomb goes somewhere between round 8 and round 20
    bombPos = 8 + Math.floor(Math.random()*13);
    deck = shuffled;
    round = 0;
  }

  function getTask() {
    return deck[round % deck.length];
  }

  function fillTask(task) {
    const p  = players[round % players.length];
    let p2idx = (round+1) % players.length;
    if (players.length>1 && p2idx === (round % players.length)) p2idx = (p2idx+1)%players.length;
    const p2 = players[p2idx];
    return {
      text: task.text
        .replace(/\{P2\}/g, `<span class="card-player2-inline">${p2}</span>`)
        .replace(/\{P\}/g,  `<span class="card-player-inline">${p}</span>`),
      player: p,
      cat: task.cat
    };
  }

  /* ============================================================
     SCREEN MANAGEMENT
  ============================================================ */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const target = document.getElementById(id);
    target.classList.add('active');
  }

  /* ============================================================
     COUNTDOWN
  ============================================================ */
  function startCountdown(cb) {
    showScreen('screen-countdown');
    let n = 3;
    const numEl = document.getElementById('countdown-num');
    numEl.textContent = n;
    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        numEl.textContent = '🌊 GO!';
        numEl.style.fontSize = 'clamp(2rem,10vw,4rem)';
        setTimeout(() => { numEl.style.fontSize = ''; cb(); }, 700);
      } else {
        numEl.textContent = n;
        // re-trigger animation via style reset
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';
        Audio.playBlip();
      }
    }, 800);
    Audio.playBlip();
  }

  /* ============================================================
     RENDER CARD
  ============================================================ */
  function renderCard() {
    const task   = getTask();
    const filled = fillTask(task);

    document.getElementById('round-num').textContent       = round + 1;
    document.getElementById('card-category').textContent   = filled.cat;
    // set color per category type
    const catEl = document.getElementById('card-category');
    const catColors = {
      '🕺': '#ff69b4',
      '🎧': '#a855f7',
      '📝': '#10b981',
      '👻': '#f97316',
      '👑': '#eab308',
      '🎭': '#ec4899',
      '📱': '#3b82f6',
      '🙈': '#ef4444',
      '🎮': '#8b5cf6',
      '🌈': '#06b6d4',
      '💘': '#db2777',
      '😍': '#f43f5e',
      '🎬': '#14b8a6',
      '🏆': '#f59e0b',
      '🍸': '#0f766e',
      '🍻': '#ca8a04',
    };
    const catKey = Object.keys(catColors).find(k => filled.cat.includes(k));
    catEl.style.background = catKey ? catColors[catKey] : 'var(--pink)';
    catEl.innerHTML = filled.cat;

    document.getElementById('card-player-name').textContent = filled.player;
    document.getElementById('card-task-text').innerHTML     = filled.text;

    // bomb danger mode after 60% of bombPos
    const danger = round >= Math.floor(bombPos * 0.6);
    const indicator = document.getElementById('bomb-indicator');
    indicator.classList.toggle('danger', danger);

    // re-trigger card flip animation via style reset
    const card = document.getElementById('task-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'cardFlip .3s ease-out';
  }

  /* ============================================================
     EVENT LISTENERS
  ============================================================ */
  // Welcome
  document.getElementById('btn-play').addEventListener('click', () => {
      Audio.unlockAudio();
    Audio.init();
    Audio.playBlip();
    showScreen('screen-players');
  });

  document.getElementById('btn-music-toggle').addEventListener('click', () => {
    Audio.init();
    const on = Audio.toggleMusic();
    document.getElementById('btn-music-toggle').textContent =
      on ? '🎵 MUSIC: ON' : '🔇 MUSIC: OFF';
    Audio.playBlip();
  });

  // Players
  function addPlayer() {
    const input = document.getElementById('name-input');
    const name  = input.value.trim();
    if (!name || players.length >= 8) return;
    if (players.includes(name)) { input.value=''; return; }
    players.push(name);
    input.value = '';
    renderPlayerList();
    Audio.playBlip();
  }

  function renderPlayerList() {
    const list  = document.getElementById('player-list');
    const hint  = document.getElementById('player-hint');
    const btn   = document.getElementById('btn-start-game');
    list.innerHTML = '';
    players.forEach((p,i) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = '<span>\u2665 ' + p + '</span><button class="player-remove" data-i="' + i + '">\u2715</button>';
      chip.querySelector('.player-remove').addEventListener('click', () => {
        players.splice(i,1);
        renderPlayerList();
      });
      list.appendChild(chip);
    });
    const n = players.length;
    hint.textContent = n === 0 ? 'add 2–8 players to start!'
                     : n === 1 ? 'add at least one more player!'
                     : n + ' players ready! \u2605';
    btn.disabled = n < 2;
  }

  document.getElementById('btn-add-player').addEventListener('click', addPlayer);
  document.getElementById('name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayer();
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    if (players.length < 2) return;
    Audio.playSuccess();
    buildDeck();
    startCountdown(() => {
      renderCard();
      showScreen('screen-game');
      Audio.startBGM();
    });
  });

  document.getElementById('btn-back-welcome').addEventListener('click', () => {
    Audio.playBlip();
    players = [];
    renderPlayerList();
    showScreen('screen-welcome');
  });

  // Game
  document.getElementById('btn-next-card').addEventListener('click', () => {
    round++;
    if (round >= bombPos) {
      // BOMB!
      Audio.stopBGM();
      setTimeout(() => Audio.playBomb(), 100);
      const loser = players[round % players.length];
      document.getElementById('bomb-loser-text').textContent =
        '💣 ' + loser + ' triggered the bomb!';
      showScreen('screen-bomb');
      // shake the bomb screen
      document.getElementById('screen-bomb').classList.remove('bomb-shake');
      void document.getElementById('screen-bomb').offsetWidth;
      document.getElementById('screen-bomb').classList.add('bomb-shake');
    } else {
      Audio.playBlip();
      renderCard();
    }
  });

  document.getElementById('btn-end-game').addEventListener('click', () => {
    Audio.playBlip();
    Audio.stopBGM();
    players = [];
    renderPlayerList();
    showScreen('screen-welcome');
  });

  // Bomb
  document.getElementById('btn-play-again').addEventListener('click', () => {
    Audio.playBlip();
    players = [];
    renderPlayerList();
    showScreen('screen-players');
  });

  /* ============================================================
     INITIAL RENDER
  ============================================================ */
  renderPlayerList();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .catch(err => console.error('Service worker registration failed:', err));
    });
  }
