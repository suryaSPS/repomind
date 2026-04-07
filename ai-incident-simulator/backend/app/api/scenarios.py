from fastapi import APIRouter, HTTPException
from ..models.scenario import ScenarioTemplate, AttackCategory, Difficulty

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

SCENARIO_TEMPLATES: list[ScenarioTemplate] = [
    ScenarioTemplate(
        id="ransomware-hospital-2024",
        title="Ransomware Attack on Regional Hospital Network",
        category=AttackCategory.RANSOMWARE,
        difficulty=Difficulty.INTERMEDIATE,
        description=(
            "A LockBit 3.0 variant has been detected spreading across a regional hospital's "
            "network. Patient care systems are at risk as the ransomware begins encrypting "
            "critical clinical databases and EHR systems."
        ),
        organization_profile=(
            "Regional hospital with 450 beds, 2,000 staff. Mix of legacy medical devices "
            "and modern EHR systems (Epic). Flat network with limited segmentation. "
            "Backup systems present but untested. 24/7 SOC with 3-person team."
        ),
        initial_indicators=[
            "EDR alert: suspicious PowerShell execution on NURSE-WS-047",
            "SIEM: mass file rename events (.lockbit extension) on \\\\fileserver01\\clinical",
            "Help desk tickets: staff unable to open patient records",
        ],
        estimated_stages=6,
    ),
    ScenarioTemplate(
        id="phishing-financial-bec",
        title="Business Email Compromise — CFO Impersonation",
        category=AttackCategory.PHISHING,
        difficulty=Difficulty.BEGINNER,
        description=(
            "A sophisticated spear-phishing campaign targeting a mid-size financial services "
            "firm. The attacker has compromised the CFO's email account and is orchestrating "
            "fraudulent wire transfers while maintaining persistence."
        ),
        organization_profile=(
            "Regional investment firm with 200 employees and $2B AUM. Microsoft 365 environment. "
            "No MFA enforced on executive accounts. Single SOC analyst on duty."
        ),
        initial_indicators=[
            "User report: CFO email requesting urgent $240K wire transfer",
            "Azure AD alert: CFO account login from unusual IP (185.234.XX.XX, Romania)",
            "Email gateway: forwarding rule added to CFO mailbox sending to external address",
        ],
        estimated_stages=5,
    ),
    ScenarioTemplate(
        id="supply-chain-npm-2024",
        title="Supply Chain Compromise via Malicious NPM Package",
        category=AttackCategory.SUPPLY_CHAIN,
        difficulty=Difficulty.ADVANCED,
        description=(
            "A widely-used internal NPM package has been backdoored. The compromise "
            "was introduced 3 weeks ago and has been silently exfiltrating environment "
            "variables and secrets from production CI/CD pipelines across the organization."
        ),
        organization_profile=(
            "SaaS company, 800 engineers, 40+ microservices in production. "
            "GitHub Actions CI/CD. Secrets in GitHub Actions and AWS SSM Parameter Store. "
            "Package serves as a shared utility library used in 23 services."
        ),
        initial_indicators=[
            "Unusual outbound HTTPS traffic to obscure domain from CI runner: api-metrics-cdn[.]io",
            "GitHub alert: package version 2.4.1 published by unfamiliar contributor",
            "AWS GuardDuty: credential anomaly — API calls from unexpected IP ranges",
        ],
        estimated_stages=7,
    ),
    ScenarioTemplate(
        id="insider-threat-data-exfil",
        title="Insider Threat — Privileged Admin Data Exfiltration",
        category=AttackCategory.INSIDER_THREAT,
        difficulty=Difficulty.INTERMEDIATE,
        description=(
            "A soon-to-be-terminated senior database administrator has been discovered "
            "exfiltrating customer PII and proprietary source code. The activity has been "
            "ongoing for 2 weeks and volume is accelerating."
        ),
        organization_profile=(
            "E-commerce company, 500 employees. PostgreSQL databases with 4M customer records. "
            "GitLab self-hosted. DLP solution present but misconfigured. "
            "HR has notified IT of upcoming termination on Monday."
        ),
        initial_indicators=[
            "DLP alert: 2.4GB archive uploaded to personal Dropbox from DB-ADMIN workstation",
            "Database audit log: bulk SELECT on customers table (47M rows) — off-hours",
            "GitLab: 3 private repos cloned to personal machine at 11:47 PM last night",
        ],
        estimated_stages=5,
    ),
    ScenarioTemplate(
        id="apt-government-espionage",
        title="APT Intrusion — Nation-State Espionage Campaign",
        category=AttackCategory.APT,
        difficulty=Difficulty.ADVANCED,
        description=(
            "A sophisticated nation-state threat actor (TTPs consistent with APT29/Cozy Bear) "
            "has established persistent access within a government contractor's network. "
            "The intrusion has been active for an estimated 6 weeks, targeting defense contracts."
        ),
        organization_profile=(
            "Defense contractor, 3,000 employees, DoD SECRET-level contracts. "
            "Air-gapped classified network, but compromise appears to be on the unclassified segment. "
            "Mature SOC with SIEM, EDR, NDR. Subject to CMMC compliance requirements."
        ),
        initial_indicators=[
            "NDR: periodic beaconing to legitimate-looking domain (update-windowscdn[.]com) every 4h",
            "EDR: LOLBin abuse — certutil.exe downloading encoded payload from SharePoint",
            "Threat intel: C2 domain matches APT29 infrastructure cluster from recent report",
        ],
        estimated_stages=7,
    ),
    ScenarioTemplate(
        id="ddos-cover-breach",
        title="DDoS Attack as Cover for Data Breach",
        category=AttackCategory.DDOS,
        difficulty=Difficulty.BEGINNER,
        description=(
            "A volumetric DDoS attack is overwhelming the company's e-commerce platform "
            "during peak shopping season. Unknown to the SOC, the DDoS is a deliberate "
            "distraction — attackers are simultaneously using stolen credentials to exfiltrate "
            "payment card data from a backend database."
        ),
        organization_profile=(
            "E-commerce retailer, 150 employees, processes 50K transactions/day. "
            "AWS-hosted infrastructure, Cloudflare WAF. Small IT team of 5. "
            "PCI-DSS compliant. Attack begins Black Friday morning."
        ),
        initial_indicators=[
            "Cloudflare: DDoS attack, 840 Gbps volumetric UDP flood, site degraded",
            "AWS CloudWatch: anomalous DB query volume — 10x normal read rate on payment_cards table",
            "WAF: spike in requests from 47 countries, mostly APAC and Eastern Europe",
        ],
        estimated_stages=5,
    ),
]

_template_map = {t.id: t for t in SCENARIO_TEMPLATES}


@router.get("", response_model=list[ScenarioTemplate])
async def list_scenarios():
    return SCENARIO_TEMPLATES


@router.get("/{scenario_id}", response_model=ScenarioTemplate)
async def get_scenario(scenario_id: str):
    template = _template_map.get(scenario_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return template


def get_template(scenario_id: str) -> ScenarioTemplate:
    """Internal helper for other modules."""
    template = _template_map.get(scenario_id)
    if not template:
        raise ValueError(f"Unknown scenario: {scenario_id}")
    return template
