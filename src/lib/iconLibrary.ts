export type IconNode = [string, Record<string, string | number>][];
export type IconMap = Record<string, IconNode>;

let cache: IconMap | null = null;
let pending: Promise<IconMap> | null = null;

/** Loads the full Lucide icon set once, lazily (kept out of the main bundle). */
export async function loadIconLibrary(): Promise<IconMap> {
  if (cache) return cache;
  if (!pending) {
    pending = import("lucide").then((mod) => {
      cache = (mod as unknown as { icons: IconMap }).icons;
      return cache;
    });
  }
  return pending;
}

export function getLoadedIconLibrary(): IconMap | null {
  return cache;
}

export function iconLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export interface IconCategory {
  id: string;
  label: string;
  match?: RegExp;
}

export const ICON_CATEGORIES: IconCategory[] = [
  { id: "all", label: "Todos" },
  {
    id: "arrows",
    label: "Setas",
    match: /arrow|chevron|corner|move|undo|redo|refresh|rotate|expand|shrink|skip|step|forward|back|direction|navigation/i,
  },
  {
    id: "people",
    label: "Pessoas",
    match: /user|person|people|contact|group|team|baby|child|accessibility|hand|eye|smile|heart|brain/i,
  },
  {
    id: "tech",
    label: "Tecnologia",
    match: /cpu|server|database|cloud|wifi|bluetooth|battery|plug|code|terminal|command|keyboard|mouse|monitor|smartphone|tablet|laptop|router|network|bug|git|bot|robot|chip|hard|drive|usb|scan|qr/i,
  },
  {
    id: "business",
    label: "Negócios",
    match: /briefcase|building|bank|chart|graph|trend|target|trophy|award|medal|money|dollar|euro|credit|card|receipt|wallet|shopping|cart|store|package|box|factory|handshake|scale|gavel|landmark/i,
  },
  {
    id: "files",
    label: "Arquivos",
    match: /file|folder|document|clipboard|note|book|library|archive|inbox|mail|paperclip|attachment|printer|copy|paste|scissors|trash|save|download|upload/i,
  },
  {
    id: "shapes",
    label: "Formas",
    match: /square|circle|triangle|hexagon|octagon|diamond|star|heart|cloud|sun|moon|zap|flame|droplet|waves|infinity|plus|minus|x|check/i,
  },
  {
    id: "media",
    label: "Mídia",
    match: /play|pause|stop|record|music|audio|video|camera|image|photo|film|mic|speaker|volume|headphone|radio|tv|cast|airplay/i,
  },
  {
    id: "status",
    label: "Status",
    match: /alert|warning|error|info|help|check|badge|circle|flag|bell|lock|unlock|shield|eye|search|filter|settings|sliders|toggle/i,
  },
  {
    id: "nature",
    label: "Natureza",
    match: /leaf|tree|flower|sprout|seed|mountain|mountain|sun|moon|cloud|rain|snow|wind|flame|droplet|waves|fish|bird|cat|dog|paw|bug|flower|clover/i,
  },
];

export const EMOJI_GROUPS: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "people",
    label: "Pessoas",
    emojis:
      "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👤 👥 🫂 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙈 🙉 🙊 💁 🙅 🙆 🙋 🧏 🤦 🤷 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟".split(
        " ",
      ),
  },
  {
    id: "objects",
    label: "Objetos",
    emojis:
      "📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ ⏰ ⏲️ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 🛢️ 💸 💵 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🪞 🪟 🛋️ 🪑 🚪 🪟 🛏️ 🛌 🧸 🪆 🖼️ 🪄 🎁 🎈 🎏 🎀 🎊 🎉 🎎 🎐 🎏 🎑 🧧 🎃 🎄 🎋 🎍 🎎 🎏 🎐 🎑 🎆 🎇 🧨 ✨ 🎇 🎆 🎉 🎊 🎈 🎁 🎀 🪄 🪅 🪩 🪧 🪪 🪫 🪬".split(
        " ",
      ),
  },
  {
    id: "symbols",
    label: "Símbolos",
    emojis:
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🚹 🚺 🚼 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔁 🔂 🔀 🔙 🔚 🔛 🔜 🔝 🆗 🆕 🆒 🆓 🆙 🆖".split(
        " ",
      ),
  },
  {
    id: "nature",
    label: "Natureza",
    emojis:
      "🌍 🌎 🌏 🌐 🗺️ 🗾 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 🎠 🎡 🎢 💈 🎪 🌌 🌠 🌃 🌄 🌅 🌆 🌇 🌉 🌊 🌈 🌂 ☂️ ⛱️ ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌊 💧 💦 ☔ 🌊 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🦦 🦥 🐁 🐀 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🐚 🪸 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌚 🌙 🌛 🌜 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌿".split(
        " ",
      ),
  },
];
