import sys
from pathlib import Path
import re

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services import excel_service
from config import settings

RAW_CSV_DATA = """1,Atlassian,Global Product,Bengaluru (+ remote-in-India roles),"Backend, Full-stack, SRE, Platform","Jira, Confluence, Bitbucket - Java/Kotlin, AWS",https://www.atlassian.com/company/careers,Not yet,,
2,Google,Global Product,"Bengaluru, Hyderabad","SWE, SRE, Cloud","Search, Cloud, Android - C++/Java/Go/Python",https://www.google.com/about/careers/applications/,Not yet,,
3,Microsoft,Global Product,"Hyderabad, Bengaluru","SWE, Azure/Cloud, DevOps","Azure, Office, GitHub - C#/Java/Python",https://careers.microsoft.com,Not yet,,
4,Amazon / AWS,Global Product,"Bengaluru, Chennai, Hyderabad","SDE, Cloud Support, DevOps","AWS, e-commerce - Java/Python",https://www.amazon.jobs,Not yet,,
5,Adobe,Global Product,"Noida, Bengaluru","SDE, Cloud Engineer","Creative Cloud, Document Cloud - Java/JS",https://careers.adobe.com,Not yet,,
6,Salesforce,Global Product,"Hyderabad, Bengaluru","SWE, SRE, Cloud","CRM, Slack - Java, Heroku/Hyperforce",https://careers.salesforce.com,Not yet,,
7,Intuit,Global Product,Bengaluru,"SDE, SRE, Platform","TurboTax, QuickBooks - Java/React, AWS",https://jobs.intuit.com,Not yet,,
8,ServiceNow,Global Product,"Hyderabad, Bengaluru","SWE, Platform/Cloud",Workflow SaaS - Java/JS,https://careers.servicenow.com,Not yet,,
9,LinkedIn,Global Product,Bengaluru,"SWE, SRE","Social/Jobs platform - Java, Kafka",https://careers.linkedin.com,Not yet,,
10,Uber,Global Product,"Bengaluru, Hyderabad","Backend, Platform, SRE","Marketplace - Go/Java, microservices",https://www.uber.com/global/en/careers/,Not yet,,
11,Stripe,Global Product,Bengaluru,"Backend, Infra",Payments - Ruby/Java/Go,https://stripe.com/jobs,Not yet,,
12,Databricks,Global Product,Bengaluru,"SWE, Cloud Infra",Data/AI platform - Scala/Python/Go,https://www.databricks.com/company/careers,Not yet,,
13,Cisco,Global Product,Bengaluru,"SWE, Cloud/DevOps","Networking, Webex - Go/Python/Java",https://jobs.cisco.com,Not yet,,
14,Nutanix,Global Product,Bengaluru,"SWE, Cloud, SRE",Hybrid cloud/HCI - C++/Go/Python,https://www.nutanix.com/company/careers,Not yet,,
15,Rubrik,Global Product,Bengaluru,"SWE, Cloud Infra",Data security/backup - Go/Java,https://www.rubrik.com/company/careers,Not yet,,
16,Zscaler,Global Product,Bengaluru,"SWE, Cloud Ops/SRE",Cloud security - C/Go/Python,https://www.zscaler.com/careers,Not yet,,
17,Red Hat,Global Product,"Bengaluru, Pune","SWE, Site Reliability, Cloud","OpenShift, Linux - Go/Python/Java",https://www.redhat.com/en/jobs,Not yet,,
18,PayPal,Global Product / Fintech,"Chennai, Bengaluru","SWE, Backend, Cloud",Payments - Java/Node.js,https://careers.pypl.com,Not yet,,
19,Walmart Global Tech,Global Product,"Bengaluru, Chennai","SDE, DevOps/Platform","Retail tech - Java/Spring, cloud",https://careers.walmart.com,Not yet,,
20,GitLab,Global Product (Remote),Remote (India eligible),"Backend, SRE, Infra",DevOps platform - Ruby/Go,https://about.gitlab.com/jobs/,Not yet,,
21,Zoho,India Product,"Chennai, Tenkasi","SDE, Dev, Cloud","Zoho suite - Java, in-house stack",https://www.zoho.com/careers/,Not yet,,
22,Freshworks,India Product (Global SaaS),"Chennai, Bengaluru","SDE, Backend, SRE","Freshdesk, Freshservice - Ruby/Rails, Node.js",https://www.freshworks.com/company/careers/,Not yet,,
23,Chargebee,India Product (Global SaaS),Chennai,"SDE, Backend, DevOps",Subscription billing - Java/Node.js,https://www.chargebee.com/company/careers/,Not yet,,
24,Kissflow,India Product (Global SaaS),Chennai,"SDE, Backend",Workflow platform - Node.js/Python,https://kissflow.com/careers/,Not yet,,
25,Postman,India Product (Global SaaS),Bengaluru,"SDE, Backend, SRE",API platform - Node.js/JS,https://www.postman.com/company/careers/,Not yet,,
26,Razorpay,India Product / Fintech,Bengaluru,"SDE, Backend, DevOps/SRE",Payments - Go/PHP/Java,https://razorpay.com/jobs/,Not yet,,
27,PhonePe,India Product / Fintech,"Bengaluru, Pune","SDE, Backend, Platform",UPI/payments - Java,https://www.phonepe.com/careers/,Not yet,,
28,Juspay,India Product / Fintech,Bengaluru,"SDE, Backend",Payments - Haskell/Rust/Node,https://juspay.in/careers,Not yet,,
29,CRED,India Product / Fintech,Bengaluru,"SDE, Backend","Fintech - Kotlin/Java, Go",https://careers.cred.club,Not yet,,
30,Groww,India Product / Fintech,Bengaluru,"SDE, Backend, DevOps",Investing platform - Java,https://groww.in/careers,Not yet,,
31,Flipkart,India Product,Bengaluru,"SDE, Platform, DevOps",E-commerce - Java,https://www.flipkartcareers.com,Not yet,,
32,Swiggy,India Product,Bengaluru,"SDE, Backend, SRE",Food delivery - Java/Go,https://careers.swiggy.com,Not yet,,
33,Zomato (Eternal),India Product,"Gurugram, Bengaluru","SDE, Backend",Food delivery/Blinkit - Go/Java,https://www.zomato.com/careers,Not yet,,
34,Meesho,India Product,Bengaluru,"SDE, Backend, Platform",Social commerce - Java/Go,https://www.meesho.io/jobs,Not yet,,"""

ADDITIONAL_COMPANIES = [
    {"name": "RELX", "domain": "Information & Analytics / Publishing", "website": "https://www.relx.com/careers"},
    {"name": "Thoughtworks", "domain": "Global Software Consultancy & Product", "website": "https://www.thoughtworks.com/careers"},
    {"name": "Saint-Gobain", "domain": "Manufacturing / Digital Tech", "website": "https://www.saint-gobain.com/en/careers"},
    {"name": "Star Health Insurance", "domain": "Healthtech & Insurtech", "website": "https://www.starhealth.in/careers"},
    {"name": "Presidio", "domain": "Cloud & Digital Services", "website": "https://www.presidio.com/careers"},
    {"name": "Cotiviti", "domain": "Healthcare Analytics", "website": "https://www.cotiviti.com/careers"},
    {"name": "MicroStrategy", "domain": "Enterprise Analytics & BI", "website": "https://www.microstrategy.com/careers"},
    {"name": "Mastercard", "domain": "Fintech / Global Payments", "website": "https://careers.mastercard.com"},
    {"name": "EXL Service", "domain": "Data Analytics & Digital Operations", "website": "https://www.exlservice.com/careers"},
    {"name": "Kotak Mahindra Bank", "domain": "Digital Banking & Fintech", "website": "https://www.kotak.com/en/careers.html"},
    {"name": "CDW", "domain": "IT Solutions & Cloud Services", "website": "https://www.cdw.com/careers"},
    {"name": "Persistent Systems", "domain": "Digital Engineering & Enterprise Software", "website": "https://www.persistent.com/careers"},
    {"name": "The Access Group", "domain": "Business Management Software SaaS", "website": "https://www.theaccessgroup.com/careers"},
    {"name": "Schneider Electric", "domain": "Energy & Automation Tech", "website": "https://www.se.com/careers"},
    {"name": "Qualys", "domain": "Cloud Security & Compliance", "website": "https://www.qualys.com/company/careers"},
    {"name": "Michelin", "domain": "Digital Mobility & Tech", "website": "https://careers.michelin.com"},
    {"name": "Bentley Systems", "domain": "Infrastructure Engineering Software", "website": "https://www.bentley.com/careers"},
    {"name": "PAR Technology", "domain": "Restaurant Tech & Cloud POS", "website": "https://www.partech.com/careers"},
    {"name": "Aditya Birla Capital", "domain": "Fintech & Financial Services", "website": "https://www.adityabirlacapital.com/careers"},
    {"name": "Johnson Electric", "domain": "Motion Systems & Engineering", "website": "https://www.johnsonelectric.com/careers"},
    {"name": "Akamai Technologies", "domain": "Cloud CDN & Cyber Security", "website": "https://www.akamai.com/careers"},
    {"name": "NCS Group", "domain": "Technology Services & Digital Solutions", "website": "https://www.ncs.co/en-sg/careers"},
    {"name": "JMAN Group", "domain": "Data & Software Consultancy", "website": "https://www.jmangroup.com/careers"},
    {"name": "Toast", "domain": "Cloud Restaurant Platform", "website": "https://careers.toasttab.com"},
    {"name": "Samsung", "domain": "Consumer Tech, AI & R&D", "website": "https://www.samsung.com/in/aboutsamsung/careers"},
    {"name": "EY", "domain": "Tech Consulting & Digital Transformation", "website": "https://www.ey.com/en_in/careers"},
    {"name": "Zeta", "domain": "Fintech & Modern Banking Tech", "website": "https://www.zeta.tech/careers"},
    {"name": "Capgemini", "domain": "Technology Services & Cloud", "website": "https://www.capgemini.com/careers"},
    {"name": "Photon Interactive", "domain": "Digital Experience & AI Services", "website": "https://www.photon.com/careers"},
    {"name": "Synechron", "domain": "Digital Financial Services Consulting", "website": "https://www.synechron.com/careers"},
    {"name": "VVDN Technologies", "domain": "Product Engineering & Cloud Electronics", "website": "https://www.vvdntech.com/careers"},
    {"name": "2K Games", "domain": "Interactive Entertainment & Gaming Tech", "website": "https://careers.2k.com"},
    {"name": "Kovai.co", "domain": "Enterprise Software & Cloud SaaS", "website": "https://www.kovai.co/careers"},
    {"name": "Harman International", "domain": "Connected Tech & Automotive Audio (Samsung)", "website": "https://jobs.harman.com"},
    {"name": "Rippling", "domain": "Workforce Management SaaS", "website": "https://www.rippling.com/careers"},
    {"name": "Altimetrik", "domain": "Digital Business & Data Enablement", "website": "https://www.altimetrik.com/careers"},
    {"name": "Sanofi", "domain": "Healthcare & Digital Pharma Tech", "website": "https://www.sanofi.com/en/careers"},
    {"name": "Expedia Group", "domain": "Travel Tech & Marketplace", "website": "https://careers.expediagroup.com"},
    {"name": "Thermo Fisher Scientific", "domain": "Scientific Tech & Healthcare Software", "website": "https://jobs.thermofisher.com"},
    {"name": "Hewlett Packard Enterprise (HPE)", "domain": "Edge-to-Cloud Platform & Enterprise Tech", "website": "https://careers.hpe.com"},
    {"name": "Wayfair", "domain": "E-Commerce Tech & Supply Chain", "website": "https://aboutwayfair.com/careers"},
    {"name": "Tamara", "domain": "Fintech & Shopping Platform", "website": "https://tamara.co/careers"},
    {"name": "ThoughtSpot", "domain": "Modern Analytics & AI Data", "website": "https://www.thoughtspot.com/careers"},
    {"name": "American Express", "domain": "Fintech / Global Financial Payments", "website": "https://www.americanexpress.com/careers"},
    {"name": "Virtusa", "domain": "Digital Engineering Services", "website": "https://www.virtusa.com/careers"},
    {"name": "Ericsson", "domain": "Telecom, 5G & Cloud Networking", "website": "https://www.ericsson.com/en/careers"},
    {"name": "Apple", "domain": "Consumer Tech, Hardware, Software & AI", "website": "https://www.apple.com/careers/in/"},
    {"name": "HashedIn by Deloitte", "domain": "Cloud Engineering & AI Solutions", "website": "https://hashedin.com/careers/"},
    {"name": "Atos Syntel", "domain": "IT Services & Digital Transformation", "website": "https://atos.net/en/careers"},
    {"name": "Ascendion", "domain": "Software Engineering & Applied AI", "website": "https://ascendion.com/careers/"},
    {"name": "Biocon Biologics", "domain": "Biotech & Digital Life Sciences", "website": "https://www.biocon.com/careers/"},
    {"name": "HighLevel", "domain": "All-in-One Sales & Marketing Platform SaaS", "website": "https://www.gohighlevel.com/careers"},
]

def parse_skills(focus_stack: str) -> list[str]:
    """Extract programming languages, frameworks, and technologies."""
    known_techs = [
        "Java", "Kotlin", "AWS", "C++", "Go", "Python", "C#", "GitHub", "Azure",
        "React", "Node.js", "JS", "JavaScript", "Kafka", "Ruby", "Rails",
        "Scala", "C", "Linux", "OpenShift", "Spring", "PHP", "Haskell", "Rust",
        "DevOps", "SRE", "Cloud", "Kubernetes", "Docker", "Microservices"
    ]
    extracted = []
    text_lower = focus_stack.lower()
    for tech in known_techs:
        # Match word boundaries or special chars
        pattern = r'(?i)(?:\b|(?<=[^a-zA-Z0-9]))' + re.escape(tech) + r'(?:\b|(?=[^a-zA-Z0-9]))'
        if re.search(pattern, focus_stack):
            extracted.append(tech)
    return extracted if extracted else ["Software Engineering", "Cloud", "Backend"]

def determine_work_mode(location_text: str) -> str:
    loc_lower = location_text.lower()
    if "remote" in loc_lower:
        return "Remote"
    elif "," in loc_lower or "hybrid" in loc_lower:
        return "Hybrid"
    return "Hybrid"

def main():
    excel_path = settings.excel_path
    excel_service.initialize_workbook(excel_path)
    existing_apps = excel_service.read_applications(excel_path)

    existing_companies = {
        str(a.get("company_name", "")).strip().lower()
        for a in existing_apps
    }

    added_count = 0
    skipped_count = 0

    import csv
    import io

    f = io.StringIO(RAW_CSV_DATA.strip())
    reader = csv.reader(f)

    print("--- Importing 34 Primary Product Tech Companies ---")
    for row in reader:
        if not row or not row[0].isdigit():
            continue
        num, company, category, loc, roles, focus_stack, careers_url, applied, date_app, notes = row

        company_clean = company.strip()
        comp_key = company_clean.lower()

        # Check if already in Excel
        if comp_key in existing_companies:
            print(f"Skipping existing: {company_clean}")
            skipped_count += 1
            continue

        skills = parse_skills(focus_stack)
        work_mode = determine_work_mode(loc)

        app_payload = {
            "company_name": company_clean,
            "company_website": careers_url,
            "job_url": careers_url,
            "job_title": roles.strip() if roles else "Software Engineer (SDE / SWE)",
            "location": loc.strip(),
            "work_mode": work_mode,
            "employment_type": "FullTime",
            "experience_required": "0-4 yrs (SDE-1 / SDE-2)",
            "required_skills": skills,
            "application_status": "Wishlist",
            "application_source": "Product Company List",
            "date_discovered": "2026-11-04",
            "notes": f"Category: {category}\nFocus / Stack: {focus_stack}\nNotes from Sheet: Selective product company hiring SDE-1 / SDE-2 roles.",
        }

        try:
            excel_service.add_application(excel_path, app_payload)
            existing_companies.add(comp_key)
            added_count += 1
            print(f"[{added_count}] Added: {company_clean} ({roles})")
        except Exception as e:
            print(f"Error adding {company_clean}: {e}")

    print("\n--- Importing Additional Tech & Product Companies ---")
    for comp in ADDITIONAL_COMPANIES:
        c_name = comp["name"]
        c_key = c_name.strip().lower()

        # Skip aliases / duplicates
        if any(c_key == existing or c_key in existing for existing in existing_companies):
            print(f"Skipping duplicate/existing: {c_name}")
            skipped_count += 1
            continue

        app_payload = {
            "company_name": c_name,
            "company_website": comp["website"],
            "job_url": comp["website"],
            "job_title": "Software Engineer / Tech Role",
            "location": "India (Bengaluru / Hyderabad / Chennai / Remote)",
            "work_mode": "Hybrid",
            "employment_type": "FullTime",
            "experience_required": "0-4 yrs",
            "required_skills": ["Software Engineering", "Full Stack", "Cloud"],
            "application_status": "Wishlist",
            "application_source": "Curated Tech Company List",
            "date_discovered": "2026-11-04",
            "notes": f"Industry / Domain: {comp['domain']}\nCareers Link: {comp['website']}",
        }

        try:
            excel_service.add_application(excel_path, app_payload)
            existing_companies.add(c_key)
            added_count += 1
            print(f"[{added_count}] Added: {c_name}")
        except Exception as e:
            print(f"Error adding {c_name}: {e}")

    print(f"\n✅ Import completed successfully!")
    print(f"Total new applications transferred to Excel: {added_count}")
    print(f"Skipped duplicates: {skipped_count}")

    # Verify final total
    final_apps = excel_service.read_applications(excel_path)
    print(f"Total applications now in data/job_tracker.xlsx: {len(final_apps)}")

if __name__ == "__main__":
    main()

