"""Upload the RLT Google Play listing through the official Android Publisher API.

The service-account key is accepted by path and is never printed.
This script only creates/commits a store-listing edit; it cannot upload a build.
"""

from argparse import ArgumentParser
from pathlib import Path

from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account


PACKAGE = "com.rugbyleaguetakeover.app"
LANGUAGE = "en-AU"
API = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD_API = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"

SHORT_DESCRIPTION = (
    "The fan hub for rugby league in Las Vegas: events, travel, merch and community."
)
FULL_DESCRIPTION = """Rugby League Takeover is the fan hub for rugby league supporters heading to Las Vegas.

Plan the week
• Browse event information and official updates
• Register interest in travel packages
• Find links to ticketing and supporter activities

Join the community
• Create a profile and join the fan forum
• Share posts and images, react to other supporters, and follow the conversation
• Read updates from the RLT team and follow forum activity in the app

Shop RLT merchandise
• Browse the merch store and order securely through Stripe Checkout
• Review your order history from your account

Most information is available without an account. Signing in unlocks member features such as profiles, forum participation, order history and in-app activity alerts.

Rugby League Takeover is an independent supporter platform. Ticketing and travel availability may be provided by third parties and is subject to change."""


def checked(response, action: str):
    if not response.ok:
        raise RuntimeError(f"{action} failed ({response.status_code}): {response.text[:500]}")
    return response.json() if response.content else {}


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--key-file", type=Path, required=True)
    parser.add_argument("--icon", type=Path, required=True)
    parser.add_argument("--feature", type=Path, required=True)
    parser.add_argument("--phone-screenshot", type=Path, action="append", required=True)
    args = parser.parse_args()

    credentials = service_account.Credentials.from_service_account_file(
        args.key_file,
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    session = AuthorizedSession(credentials)

    edit = checked(
        session.post(f"{API}/applications/{PACKAGE}/edits", json={}),
        "Create Play edit",
    )
    edit_id = edit["id"]
    base = f"{API}/applications/{PACKAGE}/edits/{edit_id}"
    upload_base = f"{UPLOAD_API}/applications/{PACKAGE}/edits/{edit_id}"

    checked(
        session.put(
            f"{base}/listings/{LANGUAGE}",
            json={
                "language": LANGUAGE,
                "title": "Rugby League Takeover",
                "shortDescription": SHORT_DESCRIPTION,
                "fullDescription": FULL_DESCRIPTION,
            },
        ),
        "Update listing copy",
    )

    assets = [
        ("icon", args.icon),
        ("featureGraphic", args.feature),
        *[("phoneScreenshots", screenshot) for screenshot in args.phone_screenshot],
    ]
    for image_type, path in assets:
        checked(
            session.post(
                f"{upload_base}/listings/{LANGUAGE}/{image_type}",
                params={"uploadType": "media"},
                headers={"Content-Type": "image/png"},
                data=path.read_bytes(),
            ),
            f"Upload {image_type}",
        )
        print(f"Uploaded {image_type}: {path.name}")

    checked(session.post(f"{base}:commit", json={}), "Commit Play edit")
    print("Committed Google Play store listing edit.")


if __name__ == "__main__":
    main()
