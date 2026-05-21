import json
import subprocess
import sys
from pathlib import Path

REPO = 'socx/golf-handicap-system'
EPICS = [
    ('AUTH_EPIC_PLACEHOLDER', 'Epic: Authentication & User Management', 'product-management/stories/stories-auth.md'),
    ('PLAYERS_EPIC_PLACEHOLDER', 'Epic: Player Management', 'product-management/stories/stories-players.md'),
    ('COURSES_EPIC_PLACEHOLDER', 'Epic: Course & Tee Configuration Management', 'product-management/stories/stories-courses.md'),
    ('ROUNDS_EPIC_PLACEHOLDER', 'Epic: Round Entry & Score Processing', 'product-management/stories/stories-rounds.md'),
    ('HANDICAP_EPIC_PLACEHOLDER', 'Epic: Handicap Calculation (WHS)', 'product-management/stories/stories-handicap.md'),
    ('FRONTEND_EPIC_PLACEHOLDER', 'Epic: Frontend Application (React + Tailwind)', 'product-management/stories/stories-frontend.md'),
    ('DASHBOARD_EPIC_PLACEHOLDER', 'Epic: Dashboard & Analytics', 'product-management/stories/stories-dashboard.md'),
    ('ADMIN_EPIC_PLACEHOLDER', 'Epic: Admin Panel', 'product-management/stories/stories-admin.md'),
    ('NOTIFICATIONS_EPIC_PLACEHOLDER', 'Epic: Notifications', 'product-management/stories/stories-notifications.md'),
    ('PDF_EPIC_PLACEHOLDER', 'Epic: PDF/Scorecard Export', 'product-management/stories/stories-pdf.md'),
    ('LEADERBOARD_EPIC_PLACEHOLDER', 'Epic: Leaderboard & Rankings', 'product-management/stories/stories-leaderboard.md'),
    ('COMPETITIONS_EPIC_PLACEHOLDER', 'Epic: Competitions & Tournaments', 'product-management/stories/stories-competitions.md'),
    ('INTEGRATIONS_EPIC_PLACEHOLDER', 'Epic: Integrations & Tee-Time Booking', 'product-management/stories/stories-integrations.md'),
    ('DEVOPS_EPIC_PLACEHOLDER', 'Epic: Infrastructure & DevOps', 'product-management/stories/stories-devops.md'),
    ('SECURITY_EPIC_PLACEHOLDER', 'Epic: Security & Compliance', 'product-management/stories/stories-security.md'),
    ('PWA_EPIC_PLACEHOLDER', 'Epic: PWA & Mobile Enhancements', 'product-management/stories/stories-pwa.md'),
    ('MULTITENANCY_EPIC_PLACEHOLDER', 'Epic: Multitenancy', 'product-management/stories/stories-multitenancy.md'),
    ('BILLING_EPIC_PLACEHOLDER', 'Epic: Billing', 'product-management/stories/stories-billing.md'),
    ('AI_EPIC_PLACEHOLDER', 'Epic: AI', 'product-management/stories/stories-ai.md'),
    ('MOBILE_EPIC_PLACEHOLDER', 'Epic: Mobile', 'product-management/stories/stories-mobile.md'),
    ('TESTING_EPIC_PLACEHOLDER', 'Epic: Testing', 'product-management/stories/stories-testing.md'),
    ('ANALYTICS_EPIC_PLACEHOLDER', 'Epic: Analytics', 'product-management/stories/stories-analytics.md'),
    ('ARCHITECTURE_EPIC_PLACEHOLDER', 'Epic: Architecture', 'product-management/stories/stories-architecture.md'),
    ('INTERNATIONALISATION_EPIC_PLACEHOLDER', 'Epic: Internationalisation', 'product-management/stories/stories-internationalisation.md'),
    ('MISC_EPIC_PLACEHOLDER', 'Epic: Misc', 'product-management/stories/stories-misc.md'),
]

mappings = []
for placeholder, title, story_path in EPICS:
    body = f'See {story_path}'
    proc = subprocess.run(
        [
            'gh', 'api', f'repos/{REPO}/issues', '-X', 'POST',
            '-f', f'title={title}',
            '-f', f'body={body}',
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        print(f'FAILED creating {title}: {proc.stderr.strip()}', file=sys.stderr)
        sys.exit(proc.returncode)
    data = json.loads(proc.stdout)
    mappings.append((placeholder, data['number'], title, data['html_url']))

for placeholder, number, title, url in mappings:
    print(f'{placeholder}\t{number}\t{title}\t{url}')
