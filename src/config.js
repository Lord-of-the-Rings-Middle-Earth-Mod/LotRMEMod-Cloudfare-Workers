// The configuration file for storing constants and settings
export const WEBHOOKS = {
  news: "https://discord.com/api/webhooks/1398984325768155248/ARPRRmDJ6VMHya_Hr905A_KYapB5yPql_SIcbHW_hUdjFD8JN-lhMWmht6E-BsyS6Gbe",
  changelog: "https://discord.com/api/webhooks/1398983765501411399/kSwIBtN9n9s1OOTpm2ipTZwvJS4eDXXaTlmiTOR3Sbw8GRkVt0YLc7gFRRai106MZ5z_",
  suggestions: "https://discord.com/api/webhooks/1398984631885369424/c2kqCGW3ah-ZO9RT_ibTRS6XK4iIRegoFuwFBJ8HI8MugU7IkS0YE3t1xDCGUJdyZjpD",
  fabricblog: "https://discord.com/api/webhooks/1402972298448998422/Y_OIsHC18-Ko-hqd_aLxRkgefeWlveSD4EH0OHDqEC4wdOLR99GWakV-My6mzum0GWOd",
  mails: "https://discord.com/api/webhooks/1398966958048804875/d6VJgJGN4chwh75esIIpD6xgaDauq0-CVyuHDJ6k3sxz0KZEgNbgdWbV3Xv4Y8mmlGPQ",
  issues: "https://discord.com/api/webhooks/1400087209377271839/3gN5zBFE3ecY-Aq_NqhauIM9oaFFh-umKvpawu656kyYNVFOMIWolqet0iMAIIXHviCS",
  prs: "https://discord.com/api/webhooks/1400087209377271839/3gN5zBFE3ecY-Aq_NqhauIM9oaFFh-umKvpawu656kyYNVFOMIWolqet0iMAIIXHviCS",
  wiki: "https://discord.com/api/webhooks/1400087209377271839/3gN5zBFE3ecY-Aq_NqhauIM9oaFFh-umKvpawu656kyYNVFOMIWolqet0iMAIIXHviCS",
  workflows: "https://discord.com/api/webhooks/1400087209377271839/3gN5zBFE3ecY-Aq_NqhauIM9oaFFh-umKvpawu656kyYNVFOMIWolqet0iMAIIXHviCS"
};

export const PINGS = {
  news: "<@&1297538431001432135>",
  monthly: "<@&1346200306911940639>",
  release: "<@&1297543002222493761>",
  fabricupdates: "<@&1371820347543916554>",
  maintainers: "<@&1237743577656983665>", // For PRs from forks (first-time contributors)
  contributors: "<@&1301093445951164498>" // For PRs from branches (existing team members)
};

// Discord tags for specific post types
export const TAGS = {
  suggestions: "1283842398308532256"
};

// Avatar URL to use in Discord messages
export const AVATAR_URL = "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256";

// A default text to use for footer in messages
export const FOOTER_TEXT = "This post originates from GitHub.";
