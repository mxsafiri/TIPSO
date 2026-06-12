export type Lang = "en" | "sw";

const dict = {
  // Navigation
  "nav.home": { en: "Home", sw: "Nyumbani" },
  "nav.tips": { en: "Tips", sw: "Tips" },
  "nav.live": { en: "Live", sw: "Moja kwa Moja" },
  "nav.stats": { en: "Stats", sw: "Takwimu" },
  "nav.account": { en: "Account", sw: "Akaunti" },

  // Home
  "home.greeting": { en: "Hi", sw: "Habari" },
  "home.guest": { en: "Hi there", sw: "Karibu" },
  "home.topTips": { en: "Today's Top Tips", sw: "Mkeka wa Leo" },
  "home.viewAll": { en: "View All", sw: "Ona Zote" },
  "home.hotPicks": { en: "Hot Picks", sw: "Chaguo Moto" },
  "home.tip": { en: "Tip", sw: "Tip" },
  "home.odds": { en: "Odds", sw: "Odds" },
  "home.confidence": { en: "Confidence", sw: "Uhakika" },
  "home.todayRecord": { en: "Verified Track Record", sw: "Rekodi Iliyothibitishwa" },
  "home.accuracy": { en: "Accuracy", sw: "Usahihi" },
  "home.tipsGiven": { en: "Tips", sw: "Tips" },
  "home.roi": { en: "ROI", sw: "ROI" },
  "home.goPremium": { en: "Go Premium", sw: "Jiunge na Premium" },
  "home.goPremiumDesc": {
    en: "Unlock every tip, every day, from TZS 2,000.",
    sw: "Fungua kila tip, kila siku, kuanzia TZS 2,000.",
  },

  // Tips
  "tips.title": { en: "All Tips", sw: "Tips Zote" },
  "tips.all": { en: "All", sw: "Zote" },
  "tips.football": { en: "Football", sw: "Soka" },
  "tips.basketball": { en: "Basketball", sw: "Kikapu" },
  "tips.tennis": { en: "Tennis", sw: "Tenisi" },
  "tips.empty": { en: "No tips for this selection yet.", sw: "Hakuna tips kwa chaguo hili bado." },
  "tips.premiumLocked": { en: "Premium Tip", sw: "Tip ya Premium" },
  "tips.unlock": { en: "Unlock", sw: "Fungua" },
  "tips.today": { en: "Today", sw: "Leo" },
  "tips.tomorrow": { en: "Tomorrow", sw: "Kesho" },

  // Live
  "live.title": { en: "Live Now", sw: "Inaendelea Sasa" },
  "live.live": { en: "LIVE", sw: "LIVE" },
  "live.empty": { en: "No live matches right now. Check back soon!", sw: "Hakuna mechi zinazoendelea sasa. Rudi baadaye!" },
  "live.liveTip": { en: "Live Tip", sw: "Tip ya Sasa" },

  // Stats
  "stats.title": { en: "Performance", sw: "Utendaji" },
  "stats.subtitle": {
    en: "Every TIPSO tip is tracked publicly. No hiding, no deleting.",
    sw: "Kila tip ya TIPSO inafuatiliwa hadharani. Hakuna kuficha, hakuna kufuta.",
  },
  "stats.totalTips": { en: "Total Tips", sw: "Tips Zote" },
  "stats.accuracy": { en: "Accuracy", sw: "Usahihi" },
  "stats.roi": { en: "ROI", sw: "ROI" },
  "stats.avgOdds": { en: "Avg Odds", sw: "Wastani wa Odds" },
  "stats.streak": { en: "Win Streak", sw: "Mfululizo wa Ushindi" },
  "stats.monthly": { en: "Monthly Breakdown", sw: "Mchanganuo wa Kila Mwezi" },
  "stats.recentResults": { en: "Recent Settled Tips", sw: "Tips Zilizokamilika" },
  "stats.won": { en: "WON", sw: "IMESHINDA" },
  "stats.lost": { en: "LOST", sw: "IMEPOTEA" },
  "stats.month": { en: "Month", sw: "Mwezi" },

  // Plans
  "plans.title": { en: "Choose Your Plan", sw: "Chagua Kifurushi" },
  "plans.subtitle": { en: "Unlock premium tips and win more.", sw: "Fungua tips za premium ushinde zaidi." },
  "plans.mostPopular": { en: "Most Popular", sw: "Maarufu Zaidi" },
  "plans.perDay": { en: "/day", sw: "/siku" },
  "plans.perWeek": { en: "/week", sw: "/wiki" },
  "plans.perMonth": { en: "/month", sw: "/mwezi" },
  "plans.continue": { en: "Continue", sw: "Endelea" },
  "plans.payWith": { en: "Pay with", sw: "Lipa kwa" },
  "plans.phoneNumber": { en: "Mobile money number", sw: "Namba ya simu" },
  "plans.confirmPay": { en: "Confirm & Pay", sw: "Thibitisha na Lipa" },
  "plans.processing": { en: "Sending payment request…", sw: "Tunatuma ombi la malipo…" },
  "plans.checkPhone": {
    en: "Check your phone and enter your PIN to approve the payment.",
    sw: "Angalia simu yako na uweke PIN kuthibitisha malipo.",
  },
  "plans.success": { en: "Payment successful!", sw: "Malipo yamekamilika!" },
  "plans.activeNow": { en: "Your plan is now active. Enjoy your tips!", sw: "Kifurushi chako kimewashwa. Karibu!" },
  "plans.viewTips": { en: "View Premium Tips", sw: "Ona Tips za Premium" },
  "plans.wallet": { en: "Wallet", sw: "Pochi" },
  "plans.loginFirst": { en: "Sign in to subscribe", sw: "Ingia kwanza kujiunga" },

  // Account
  "account.title": { en: "Account", sw: "Akaunti" },
  "account.premiumMember": { en: "Premium Member", sw: "Mwanachama wa Premium" },
  "account.freeMember": { en: "Free Member", sw: "Mwanachama wa Kawaida" },
  "account.currentPlan": { en: "Current Plan", sw: "Kifurushi cha Sasa" },
  "account.validUntil": { en: "Valid until", sw: "Halali hadi" },
  "account.viewDetails": { en: "View Details", sw: "Ona Zaidi" },
  "account.noPlan": { en: "No active plan", sw: "Huna kifurushi" },
  "account.choosePlan": { en: "Choose a Plan", sw: "Chagua Kifurushi" },
  "account.tipsterPerformance": { en: "Tipster Performance", sw: "Utendaji wa Watabiri" },
  "account.tips": { en: "Tips", sw: "Tips" },
  "account.wallet": { en: "Wallet", sw: "Pochi" },
  "account.paymentHistory": { en: "Payment History", sw: "Historia ya Malipo" },
  "account.inviteEarn": { en: "Invite & Earn", sw: "Karibisha Upate" },
  "account.support": { en: "Support", sw: "Msaada" },
  "account.logout": { en: "Log Out", sw: "Toka" },
  "account.language": { en: "Language", sw: "Lugha" },
  "account.theme": { en: "Appearance", sw: "Muonekano" },
  "account.dark": { en: "Dark", sw: "Giza" },
  "account.light": { en: "Light", sw: "Mwanga" },
  "account.referralDesc": {
    en: "Share your code. You both get TZS 5,000 wallet credit.",
    sw: "Shiriki kodi yako. Nyote mnapata TZS 5,000 kwenye pochi.",
  },
  "account.topUp": { en: "Top Up", sw: "Weka Pesa" },
  "account.withdraw": { en: "Withdraw", sw: "Toa Pesa" },
  "account.amount": { en: "Amount (TZS)", sw: "Kiasi (TZS)" },
  "account.topUpSuccess": { en: "Wallet topped up!", sw: "Pochi imejazwa!" },
  "account.pendingPayment": { en: "Awaiting payment confirmation…", sw: "Inasubiri uthibitisho wa malipo…" },
  "account.requestSent": {
    en: "Withdrawal request received — we'll process it shortly.",
    sw: "Ombi la kutoa pesa limepokelewa — tutalishughulikia hivi karibuni.",
  },
  "account.signIn": { en: "Sign In", sw: "Ingia" },
  "account.signInDesc": { en: "Sign in to manage your plan and wallet.", sw: "Ingia kudhibiti kifurushi na pochi yako." },

  // Auth
  "auth.welcomeBack": { en: "Welcome back", sw: "Karibu tena" },
  "auth.loginSubtitle": { en: "Sign in to your TIPSO account", sw: "Ingia kwenye akaunti yako ya TIPSO" },
  "auth.email": { en: "Email", sw: "Barua pepe" },
  "auth.password": { en: "Password", sw: "Nenosiri" },
  "auth.name": { en: "Full name", sw: "Jina kamili" },
  "auth.phone": { en: "Phone number", sw: "Namba ya simu" },
  "auth.login": { en: "Sign In", sw: "Ingia" },
  "auth.register": { en: "Create Account", sw: "Fungua Akaunti" },
  "auth.noAccount": { en: "New to TIPSO?", sw: "Mgeni TIPSO?" },
  "auth.haveAccount": { en: "Already have an account?", sw: "Una akaunti tayari?" },
  "auth.createTitle": { en: "Join TIPSO", sw: "Jiunge na TIPSO" },
  "auth.createSubtitle": { en: "Verified tips. Transparent results.", sw: "Tips zilizothibitishwa. Matokeo ya wazi." },
  "auth.demoHint": { en: "Demo account", sw: "Akaunti ya majaribio" },
  "auth.orEmail": { en: "or continue with email", sw: "au endelea kwa barua pepe" },

  // World Cup
  "wc.banner": { en: "FIFA World Cup 2026 is on!", sw: "Kombe la Dunia 2026 linaendelea!" },
  "wc.bannerDesc": { en: "Daily verified picks for every match.", sw: "Mkeka wa kila mechi, kila siku." },

  // Misc
  "common.tzs": { en: "TZS", sw: "TZS" },
  "common.back": { en: "Back", sw: "Rudi" },
  "common.analysis": { en: "Analysis", sw: "Uchambuzi" },
  "common.kickoff": { en: "Kickoff", sw: "Kuanza" },
  "common.poweredBy": { en: "Bet responsibly. 18+ only.", sw: "Weka dau kwa busara. Miaka 18+." },
} as const;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, lang: Lang): string {
  return dict[key][lang];
}
