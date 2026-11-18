# Reel Studio

Roman Urdu reels khud banata hai aur Instagram, Facebook aur LinkedIn par schedule ke mutabiq upload karta hai.

**Kaise kaam karta hai:** Groq (free LLM) Roman Urdu script likhta hai → Microsoft Edge TTS (free, key nahi chahiye) Urdu voice-over banata hai → `@napi-rs/canvas` + `ffmpeg` 1080x1920 slide-style video banate hain → Meta Graph API / LinkedIn API se upload hoti hai.

Sab kuch free hai. Sirf ek Groq API key chahiye, aur Meta/LinkedIn ki developer apps (yeh bhi free hain).

## Zaroori cheezein
- Node.js 20+
- `ffmpeg` aur `ffprobe` PATH mein hon (Ubuntu: `sudo apt install ffmpeg`). Kisi aur jagah hon to `FFMPEG_PATH` / `FFPROBE_PATH` env set karein.

## Chalana
```bash
npm install
npm run serve      # build + start → http://localhost:3000
```
`npm run dev` aur `npm start` **ek saath na chalayein** — dono ek hi `.next` folder use karte hain aur website toot jati hai.
```
```
Schedule tabhi chalega jab server chal raha ho. 24/7 chalane ke liye PC on rakhein, ya kisi VPS par chalayein:
```bash
npm i -g pm2 && pm2 start "npm start" --name reel-studio && pm2 save
```

## Login (security)
Poori website aur saari APIs login ke peeche hain. Sirf woh user login kar sakta hai jo `.env.local` mein hai:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<lamba password>
SESSION_SECRET=<random string>
```
- Session cookie 30 din chalti hai (httpOnly, signed). Password ya `SESSION_SECRET` badalne se sab logins khatam ho jate hain.
- Ek IP se 15 minute mein 5 ghalat koshishon ke baad login lock ho jata hai.
- Agar `ADMIN_USERNAME`/`ADMIN_PASSWORD` set na hon to koi login nahi kar sakta (website band rehti hai).
- Live domain par hamesha **https** use karein, warna password network par saaf text mein jata hai.

## Keys `.env.local` mein (recommended)
`.env.example` ko `.env.local` mein copy karein aur keys bharein:
`GROQ_API_KEY, GEMINI_API_KEY, META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET`.
Jo key `.env.local` mein ho woh website ki setting se upar hoti hai, `data/settings.json` mein kabhi save nahi hoti, aur browser tak nahi jati
(website par "🔒 .env.local se" dikhta hai). `.env.local` badalne ke baad server restart karein (`npm run serve`).
Login ke baad milne wale tokens (Facebook/YouTube/LinkedIn) `data/settings.json` mein rehte hain — yeh folder share/commit na karein.

## 1. Groq key (free)
1. https://console.groq.com/keys par jayein → **Create API Key**
2. Dashboard → *Content & Voice* → key paste karein → **Save**
3. **Sirf banao (preview)** dabayein aur pehli video check karein.

## 2. Facebook Page + Instagram connect karna
Instagram par upload ke liye account **Business ya Creator** hona chahiye, aur ek **Facebook Page** se linked hona chahiye (Instagram app → Settings → Account type; Page settings → Linked accounts → Instagram).

1. https://developers.facebook.com/apps → **Create App** → use case: *Other* → type **Business**.
2. Products mein **Facebook Login for Business** add karein (ya *Facebook Login*). Settings mein **Valid OAuth Redirect URIs** mein yeh daalein:
   `http://localhost:3000/api/auth/meta/callback`
3. *App settings → Basic* se **App ID** aur **App Secret** copy karein → dashboard → *Accounts → Developer app keys* mein paste karein → **Save**.
4. **Connect Facebook + Instagram** dabayein → login karein → apna **Page** aur **Instagram account** select karein → saari permissions allow karein.

Permissions: `pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish`.
Jab tak app *Development mode* mein hai, yeh sirf un accounts ke liye kaam karta hai jo app ke admin/developer/tester hain. Aapke apne accounts ke liye yeh kaafi hai, App Review ki zaroorat nahi.

## 3. LinkedIn connect karna
1. https://www.linkedin.com/developers/apps → **Create app** (ek LinkedIn Company Page link karna zaroori hai, koi bhi chalega).
2. *Products* tab → **Sign In with LinkedIn using OpenID Connect** aur **Share on LinkedIn** dono add karein.
3. *Auth* tab → **Authorized redirect URLs** mein yeh daalein: `http://localhost:3000/api/auth/linkedin/callback`
4. **Client ID** aur **Client Secret** dashboard mein paste karein → **Save** → **Connect LinkedIn**.

LinkedIn token takreeban 60 din chalta hai. Expire ho jaye to dobara **Connect LinkedIn** dabayein.
Agar LinkedIn error de ke `LinkedIn-Version` purana hai, to dashboard mein naya version (format `YYYYMM`) daal dein.

## 3b. YouTube connect karna (Shorts)
1. https://console.cloud.google.com → naya project → **APIs & Services → Library** → **YouTube Data API v3** enable karein.
2. **OAuth consent screen** → External → apna email *Test user* mein add karein.
3. **Credentials → Create credentials → OAuth client ID** → type **Web application** → Authorized redirect URI:
   `http://localhost:3000/api/auth/youtube/callback`
4. Client ID + Client Secret → website → **Accounts → Developer app keys** → Save → **Connect YouTube**.

Note: Google naye (unverified) API projects ki uploads ko **private** rakhta hai jab tak project audit na ho. Public uploads ke liye Google ka "YouTube API Services audit" form bharna padta hai.

## AI label
**Accounts** page par "AI label lagao" ON ho to har upload par platform ka official AI switch ON hota hai:
Instagram `is_ai_generated` (AI info), Facebook Reels `is_ai_generated`, YouTube `containsSyntheticMedia`.
LinkedIn ki API mein yeh switch nahi, wahan caption mein "🤖 AI-generated" note lagta hai.

## 4. Schedule
*Schedule* card mein din aur time chunein (jaise `09:00, 19:30`), timezone (default `Asia/Karachi`) set karein, **Schedule ON** karein aur **Save** dabayein.
Har scheduled time par ek nayi video banti hai aur enabled platforms par upload ho jaati hai. *Topic queue* mein topics likhe hon to woh line by line use hote hain, warna AI khud naya topic chunta hai (purane topics repeat nahi karta).

## Customize
- **Background music:** koi bhi royalty-free MP3 `assets/music.mp3` par rakh dein. Halki volume par mix ho jayegi.
- **Fonts:** `assets/fonts/Bold.ttf` aur `assets/fonts/Regular.ttf` rakh dein.
- **Colors/layout:** `lib/video.ts`
- **Script ka style/prompt:** `lib/script.ts`
- **CLI:** `npm run generate -- "Docker kya hai" --no-publish`

## Data
Settings, tokens aur history `data/` folder mein hain (`settings.json`, `history.json`, `output/<id>/reel.mp4`). Is folder mein secrets hain, ise share ya commit na karein.
Dashboard mein login nahi hai, isliye ise sirf apne PC/localhost par chalayein. Internet par expose karna ho to pehle koi auth laga lein.
