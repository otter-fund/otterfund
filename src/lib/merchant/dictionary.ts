// Seed dictionary of well-known subscription/merchant → domain mappings. This is
// the free, instant tier of merchant resolution: a normalized name that hits
// here never touches Claude. Keys are already normalized (see normalizeKey in
// resolve.ts) — lowercase, alphanumerics + spaces only. Extend freely; anything
// missing falls through to the AI resolver and is then cached in the Merchant
// table forever.

export interface DictionaryEntry {
  displayName: string;
  domain: string;
}

export const MERCHANT_DICTIONARY: Record<string, DictionaryEntry> = {
  netflix: { displayName: "Netflix", domain: "netflix.com" },
  spotify: { displayName: "Spotify", domain: "spotify.com" },
  "spotify premium": { displayName: "Spotify", domain: "spotify.com" },
  "disney plus": { displayName: "Disney+", domain: "disneyplus.com" },
  "disney+": { displayName: "Disney+", domain: "disneyplus.com" },
  hulu: { displayName: "Hulu", domain: "hulu.com" },
  "hbo max": { displayName: "Max", domain: "max.com" },
  max: { displayName: "Max", domain: "max.com" },
  "youtube premium": { displayName: "YouTube Premium", domain: "youtube.com" },
  "youtube tv": { displayName: "YouTube TV", domain: "tv.youtube.com" },
  youtube: { displayName: "YouTube", domain: "youtube.com" },
  "amazon prime": { displayName: "Amazon Prime", domain: "amazon.com" },
  "prime video": { displayName: "Prime Video", domain: "primevideo.com" },
  "amazon music": { displayName: "Amazon Music", domain: "music.amazon.com" },
  "apple music": { displayName: "Apple Music", domain: "music.apple.com" },
  "apple tv": { displayName: "Apple TV+", domain: "tv.apple.com" },
  "apple tv plus": { displayName: "Apple TV+", domain: "tv.apple.com" },
  icloud: { displayName: "iCloud+", domain: "icloud.com" },
  "icloud plus": { displayName: "iCloud+", domain: "icloud.com" },
  "apple one": { displayName: "Apple One", domain: "apple.com" },
  "google one": { displayName: "Google One", domain: "one.google.com" },
  "google storage": { displayName: "Google One", domain: "one.google.com" },
  paramount: { displayName: "Paramount+", domain: "paramountplus.com" },
  "paramount plus": { displayName: "Paramount+", domain: "paramountplus.com" },
  peacock: { displayName: "Peacock", domain: "peacocktv.com" },
  crunchyroll: { displayName: "Crunchyroll", domain: "crunchyroll.com" },
  audible: { displayName: "Audible", domain: "audible.com" },
  tidal: { displayName: "Tidal", domain: "tidal.com" },
  pandora: { displayName: "Pandora", domain: "pandora.com" },
  siriusxm: { displayName: "SiriusXM", domain: "siriusxm.com" },

  // Productivity / cloud
  notion: { displayName: "Notion", domain: "notion.so" },
  dropbox: { displayName: "Dropbox", domain: "dropbox.com" },
  "google workspace": { displayName: "Google Workspace", domain: "workspace.google.com" },
  gsuite: { displayName: "Google Workspace", domain: "workspace.google.com" },
  microsoft: { displayName: "Microsoft 365", domain: "microsoft.com" },
  "microsoft 365": { displayName: "Microsoft 365", domain: "microsoft.com" },
  "office 365": { displayName: "Microsoft 365", domain: "microsoft.com" },
  slack: { displayName: "Slack", domain: "slack.com" },
  zoom: { displayName: "Zoom", domain: "zoom.us" },
  evernote: { displayName: "Evernote", domain: "evernote.com" },
  todoist: { displayName: "Todoist", domain: "todoist.com" },
  "1password": { displayName: "1Password", domain: "1password.com" },
  lastpass: { displayName: "LastPass", domain: "lastpass.com" },
  dashlane: { displayName: "Dashlane", domain: "dashlane.com" },
  linear: { displayName: "Linear", domain: "linear.app" },
  figma: { displayName: "Figma", domain: "figma.com" },
  canva: { displayName: "Canva", domain: "canva.com" },
  grammarly: { displayName: "Grammarly", domain: "grammarly.com" },
  github: { displayName: "GitHub", domain: "github.com" },
  "github copilot": { displayName: "GitHub Copilot", domain: "github.com" },
  gitlab: { displayName: "GitLab", domain: "gitlab.com" },
  vercel: { displayName: "Vercel", domain: "vercel.com" },
  netlify: { displayName: "Netlify", domain: "netlify.com" },
  cloudflare: { displayName: "Cloudflare", domain: "cloudflare.com" },
  "aws": { displayName: "Amazon Web Services", domain: "aws.amazon.com" },
  "amazon web services": { displayName: "Amazon Web Services", domain: "aws.amazon.com" },
  digitalocean: { displayName: "DigitalOcean", domain: "digitalocean.com" },

  // AI
  "chatgpt plus": { displayName: "ChatGPT Plus", domain: "openai.com" },
  chatgpt: { displayName: "ChatGPT", domain: "openai.com" },
  openai: { displayName: "OpenAI", domain: "openai.com" },
  "claude pro": { displayName: "Claude Pro", domain: "claude.ai" },
  anthropic: { displayName: "Anthropic", domain: "anthropic.com" },
  "midjourney": { displayName: "Midjourney", domain: "midjourney.com" },
  "perplexity": { displayName: "Perplexity", domain: "perplexity.ai" },

  // Design / creative
  adobe: { displayName: "Adobe", domain: "adobe.com" },
  "adobe cc": { displayName: "Adobe Creative Cloud", domain: "adobe.com" },
  "adobe creative cloud": { displayName: "Adobe Creative Cloud", domain: "adobe.com" },
  "creative cloud": { displayName: "Adobe Creative Cloud", domain: "adobe.com" },

  // Fitness / health
  peloton: { displayName: "Peloton", domain: "onepeloton.com" },
  strava: { displayName: "Strava", domain: "strava.com" },
  calm: { displayName: "Calm", domain: "calm.com" },
  headspace: { displayName: "Headspace", domain: "headspace.com" },
  whoop: { displayName: "WHOOP", domain: "whoop.com" },
  fitbit: { displayName: "Fitbit", domain: "fitbit.com" },

  // News / reading
  "new york times": { displayName: "The New York Times", domain: "nytimes.com" },
  nyt: { displayName: "The New York Times", domain: "nytimes.com" },
  "wall street journal": { displayName: "The Wall Street Journal", domain: "wsj.com" },
  wsj: { displayName: "The Wall Street Journal", domain: "wsj.com" },
  medium: { displayName: "Medium", domain: "medium.com" },
  substack: { displayName: "Substack", domain: "substack.com" },
  economist: { displayName: "The Economist", domain: "economist.com" },
  "kindle unlimited": { displayName: "Kindle Unlimited", domain: "amazon.com" },

  // Gaming
  "xbox game pass": { displayName: "Xbox Game Pass", domain: "xbox.com" },
  "playstation plus": { displayName: "PlayStation Plus", domain: "playstation.com" },
  "nintendo switch online": { displayName: "Nintendo Switch Online", domain: "nintendo.com" },
  steam: { displayName: "Steam", domain: "steampowered.com" },
  "ea play": { displayName: "EA Play", domain: "ea.com" },
  twitch: { displayName: "Twitch", domain: "twitch.tv" },
  discord: { displayName: "Discord", domain: "discord.com" },
  "discord nitro": { displayName: "Discord Nitro", domain: "discord.com" },

  // Telecom / utilities (recurring, common on statements)
  verizon: { displayName: "Verizon", domain: "verizon.com" },
  "at t": { displayName: "AT&T", domain: "att.com" },
  att: { displayName: "AT&T", domain: "att.com" },
  "t mobile": { displayName: "T-Mobile", domain: "t-mobile.com" },
  comcast: { displayName: "Comcast", domain: "xfinity.com" },
  xfinity: { displayName: "Xfinity", domain: "xfinity.com" },

  // Food / delivery memberships
  "doordash": { displayName: "DoorDash", domain: "doordash.com" },
  "dashpass": { displayName: "DoorDash DashPass", domain: "doordash.com" },
  "uber one": { displayName: "Uber One", domain: "uber.com" },
  "instacart": { displayName: "Instacart", domain: "instacart.com" },
  "hellofresh": { displayName: "HelloFresh", domain: "hellofresh.com" },
};
