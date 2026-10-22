export type LearnTopic = {
  slug: string;
  number: string;
  title: string;
  image: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
  sources: { label: string; url: string }[];
  disclaimer: string;
};

export const learnTopics: LearnTopic[] = [
  {
    slug: "evidence",
    number: "01",
    title: "Evidence: trace every conclusion back to something verifiable",
    image: "/augi-evidence-desk.png",
    summary:
      "How AUGI turns raw public records — DNS answers, government feeds, IP registries — into conclusions you can check yourself.",
    sections: [
      {
        heading: "What counts as evidence here",
        body: [
          "Evidence is a public record anyone can re-check: a DNS answer returned by a resolver, an entry in a government catalog, a registration record in a public IP registry. If a claim cannot be traced to one of those, AUGI labels it as context or opinion — never as fact.",
          'For example, when a domain check reports "no DMARC policy", the underlying evidence is the exact DNS query and response: the resolver asked for _dmsarc-style TXT records and received none. You can reproduce that query yourself in seconds, and members see the raw answer in their report.',
        ],
      },
      {
        heading: "Why scores are summaries, not verdicts",
        body: [
          "A posture score condenses several checks into one number so it can be compared over time. It is a summary of the evidence, not a judgment about the owner of a domain, server, or IP address. Two domains with the same score can have very different stories behind it.",
          "That is why every AUGI report pairs the score with its raw evidence and an explanation of what each signal can and cannot prove. A missing record is a configuration gap — not proof of compromise, and never an accusation.",
        ],
      },
      {
        heading: "Reproducibility is the standard",
        body: [
          "Every report lists its sources with timestamps. If a source is down, the report says so instead of filling the gap with estimates. This is the same standard used by public vulnerability catalogs: a known-exploited entry exists because a government agency verified exploitation, not because a model guessed it.",
        ],
      },
    ],
    sources: [
      {
        label: "CISA Known Exploited Vulnerabilities Catalog",
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      },
      { label: "Google DNS resolver (public)", url: "https://dns.google" },
    ],
    disclaimer:
      "Educational information about AUGI methods. It is not legal, financial, or incident-response advice.",
  },
  {
    slug: "signal",
    number: "02",
    title: "Signal: read what the public layer can actually tell you",
    image: "/augi-public-signal.png",
    summary:
      "The internet publishes a surprising amount: mail routing, name servers, ASN ownership, abuse reports. Learn what each signal means — and what it does not.",
    sections: [
      {
        heading: "The public signals AUGI reads",
        body: [
          "Mail routing (MX): which servers accept email for a domain. Missing or broken MX means mail may fail — a real operational problem, visible to anyone.",
          "Sender policy (SPF) and abuse reporting (DMARC): published rules that tell receiving servers which senders are authorized and what to do with fakes. Together they stop a large share of email spoofing.",
          "IP registry data (ASN, organization, registered location): who an address block belongs to, per the public routing registry. Useful for understanding infrastructure — not for identifying people.",
          "Abuse reports: communities like AbuseIPDB collect reports of hostile behavior from specific addresses. A high abuse confidence score is a useful triage signal, but reports can be wrong, outdated, or gamed.",
        ],
      },
      {
        heading: "What the public layer cannot tell you",
        body: [
          "It cannot identify the person using an address. Behind one IP there may be thousands of people behind carrier-grade NAT, a VPN exit, or a cloud server. A registered city is often just where a company's equipment sits.",
          "It cannot prove intent. A misconfigured server is not an attack; an abuse report is not a conviction. Signals raise questions — your own logs and official channels answer them.",
        ],
      },
      {
        heading: "How to combine signals responsibly",
        body: [
          "Treat every signal as one line of testimony. Cross-check the same question from a second source before acting, and prefer defensive responses — tightening your own configuration, blocking at your edge, reporting through official channels — over any action that reaches toward a person.",
        ],
      },
    ],
    sources: [
      { label: "AbuseIPDB", url: "https://www.abuseipdb.com/" },
      {
        label: "RFC 7489 (DMARC)",
        url: "https://datatracker.ietf.org/doc/html/rfc7489",
      },
    ],
    disclaimer:
      "Educational information about public internet data. An IP address is not a person.",
  },
  {
    slug: "protection",
    number: "03",
    title: "Protection: turn clarity into a safer next step",
    image: "/augi-protection-network.png",
    summary:
      'Findings only matter if they change what you do. A practical path from "I see a gap" to "my configuration is stronger today".',
    sections: [
      {
        heading: "The triage order that works",
        body: [
          "1. Fix what is clearly yours. If your own domain lacks SPF, DMARC, or correct MX records, that is a configuration task with a known fix — start there before anything else.",
          "2. Check exposure you control. Software listed in a government exploited-vulnerability catalog and running on your systems is a patching priority, not an anxiety item. Catalog entries include the affected product for exactly this reason.",
          "3. Watch, then block. For an address showing abusive behavior, match it against your own logs first. If it appears, block or rate-limit it at your firewall or edge — evidence-based, reversible, and documented.",
        ],
      },
      {
        heading: "Document everything",
        body: [
          "Keep the report, the timestamp, and the action you took. If you ever need to explain a block to a provider, a client, or a court, a dated evidence trail is what makes your decision defensible.",
        ],
      },
      {
        heading: "What protection is not",
        body: [
          "It is not retaliation, scanning someone else's systems, or contacting people behind addresses. Those actions create legal risk for you and are outside AUGI's purpose. Defense only — that boundary is what makes the tool safe to use.",
        ],
      },
    ],
    sources: [
      {
        label: "CISA Known Exploited Vulnerabilities Catalog",
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      },
    ],
    disclaimer:
      "General security education, not incident-response or legal advice for a specific event.",
  },
  {
    slug: "community",
    number: "04",
    title:
      "Community: security knowledge is stronger with more lived experience in the room",
    image: "/augi-community-research.png",
    summary:
      "Who gets to understand security is a design choice. AUGI is built so the explanations work for people outside the industry.",
    sections: [
      {
        heading: "Why plain language is a security feature",
        body: [
          'Most harm from scams, spoofed email, and fraudulent sites lands on people who were never taught the vocabulary. When a report says "this domain has no abuse-reporting policy, here is what that means and here is the one-line fix", the reader can act without hiring anyone.',
          "Every AUGI explanation is written to that standard: define the term, show the evidence, give the next step, state the limit.",
        ],
      },
      {
        heading: "Different lived experience finds different threats",
        body: [
          "Communities are targeted differently — fraudulent messages tuned to specific languages, institutions, and trusts. Researchers closest to a community see those patterns first. That is why AUGI's research posture is collaborative rather than gatekept.",
        ],
      },
      {
        heading: "Contribute responsibly",
        body: [
          "Report abuse through the proper channels (providers, platform abuse forms, national cyber authorities). Share write-ups that include evidence and limits. Correct gently and publicly — the community learns from the correction, not from the pile-on.",
        ],
      },
    ],
    sources: [
      { label: "Report cybercrime (US)", url: "https://www.ic3.gov/" },
      { label: "CISA reporting", url: "https://www.cisa.gov/report" },
    ],
    disclaimer:
      "Community guidance, not legal advice. Follow the reporting rules that apply in your jurisdiction.",
  },
  {
    slug: "collaboration",
    number: "05",
    title: "Collaboration: make the next decision together, with context",
    image: "/augi-diverse-protection.png",
    summary:
      "Security decisions get better when they are reviewed. How to run a small team's review loop without slowing anyone down.",
    sections: [
      {
        heading: "The review loop",
        body: [
          "One person runs the check. A second reads the evidence and challenges the reading. The decision — patch, block, escalate, or wait — is written down with its reason. Small teams can run this in fifteen minutes; the written record is the part that compounds.",
        ],
      },
      {
        heading: "Separate roles on purpose",
        body: [
          "The person who found the signal should not be the only one who decides the response. Fresh eyes catch the misread signal — the abuse report that turned out to be stale, the DNS change that was a planned migration. AUGI's workspace supports this: saved reports and IP dossiers are per-account, so a reviewer can be granted their own access instead of sharing credentials.",
        ],
      },
      {
        heading: "Escalation paths worth agreeing on in advance",
        body: [
          "Decide before you need them: when you contact your provider's abuse team, when you involve legal, and when you report to a national authority. Agreeing early keeps a stressful event from becoming an improvised one.",
        ],
      },
    ],
    sources: [{ label: "CISA reporting", url: "https://www.cisa.gov/report" }],
    disclaimer: "Team-practice guidance, not legal advice.",
  },
];

export function getLearnTopic(slug: string) {
  return learnTopics.find((topic) => topic.slug === slug) ?? null;
}
