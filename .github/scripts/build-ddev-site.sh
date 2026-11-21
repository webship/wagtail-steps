#!/usr/bin/env bash
# Builds the site the suite runs against: the official Wagtail Bakery demo (github.com/wagtail/bakerydemo,
# BSD-3-Clause) with its demo content, in a DDEV project, run the way the demo's own production image runs it:
#
#   - https://<project>.ddev.site/        the bakery's site and its admin (/admin/), served by uWSGI (the
#                                          demo's production server, from its binary wheel) in the web container,
#                                          the router of the container tool sending the project's address to it;
#   - https://<project>.ddev.site:8026/   the project's mail catcher (Mailpit), which the site sends its mail to.
#
# DDEV has no project type for Wagtail, so the project is a generic one:
#   - Python in the web image: uv, and the Python the demo runs on (.ddev/web-build/Dockerfile.wagtail); the
#     packages in a virtual environment of the project (.venv/);
#   - PostgreSQL 16 from DDEV, the container's own db / db / db (DATABASE_URL);
#   - the demo's production settings (DEBUG off, its own 404 and 500 pages, its static files collected and served
#     compressed), with the mail sent over SMTP to the mail catcher (bakerydemo/settings/container.py, written by
#     site/wagtail-site.py) and the address of the admin's links the project's;
#   - the demo content (load_initial_data: 35 pages, 39 images, 2 documents, the snippets, a form and its
#     submission, redirects, the "Moderators approval" workflow), and the demo's site answering at the project's
#     address.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME      the DDEV project name                                          (default wagtailsteps)
#   SITE_DIR          the project folder                                             (default a new temporary folder)
#   WAGTAIL_VERSION   the release line of the demo: 8.1, the current one, or 7.4, the long-term-support one; each is
#                     the demo at the commit that last ran on that line                (default 8.1)
#   BAKERYDEMO_REF    another commit, branch or tag of the demo (WAGTAIL_VERSION is then only a label)
#   PYTHON_VERSION    the Python of the site                                         (default 3.12, the demo's own)
#   ACCOUNT_PASSWORD  the password of the accounts below                            (default dD.123123ddd)
#   ACCOUNTS_ONLY     1: build nothing, give the accounts of the site in SITE_DIR back their password, address and
#                     group (after a run that was stopped half way)
#   TIDY_ONLY         1: build nothing, remove what a run that was stopped half way left on the site in SITE_DIR
#
# The accounts are configuration: this script makes them and cucumber.js names them; the features never create or
# delete one. Each logs in with its user name.
#   administrator  administrator@example.com  a superuser
#   editor         editor@example.com         the Editors group: adds and changes pages, submits them for moderation
#   moderator      moderator@example.com      the Moderators group: also publishes, locks, unlocks and reviews
#   member         member@example.com         no group: an account of the site with no access to the admin
# editor and moderator are the demo's own accounts (Eddy Thorsørensen and Jordan Rules): the build gives them the
# password above. The demo's other accounts (admin, inactive, german, arabic) keep the demo's password.
#
# No hosted service, no account anywhere, nothing that is not open source.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-wagtailsteps}"
WAGTAIL_VERSION="${WAGTAIL_VERSION:-8.1}"
PYTHON_VERSION="${PYTHON_VERSION:-3.12}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../site" && pwd)/wagtail-site.py"
ROOT=/var/www/html
APP="${ROOT}/app"
PORT=8000
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"
# uv, a release of 2026-11-03; pyuwsgi is the demo's production server (uWSGI) as a binary wheel.
UV_VERSION=0.13.7

# The demo at the commit that last ran on each release line ("Upgrade to Wagtail 8.1 final"; the last commit before
# "Upgrade to Wagtail 8.0").
case "$WAGTAIL_VERSION" in
  8.1) DEFAULT_REF=890285b95dcf980215ab9e9942d64ed2b47c48c3 ;;
  7.4) DEFAULT_REF=8e2b625755d8942412d5b7627b146a795933b8b2 ;;
  *) DEFAULT_REF="" ;;
esac
BAKERYDEMO_REF="${BAKERYDEMO_REF:-$DEFAULT_REF}"
if [ -z "$BAKERYDEMO_REF" ]; then
  echo "WAGTAIL_VERSION is 8.1 or 7.4 (or give BAKERYDEMO_REF), not ${WAGTAIL_VERSION}." >&2
  exit 1
fi

# wagtail-site.py with the site's Python, in the demo's folder. The accounts travel as base64 of a JSON object, in a
# first line before the script on Python's standard input: never on a command line, never in a file.
site_script() {
  local accounts
  accounts="$(ACCOUNT_PASSWORD="$ACCOUNT_PASSWORD" python3 -c '
import base64, json, os
p = os.environ["ACCOUNT_PASSWORD"]
print(base64.b64encode(json.dumps({"accounts": [
    {"name": "administrator", "email": "administrator@example.com", "password": p, "role": "superuser"},
    {"name": "editor", "email": "editor@example.com", "password": p, "role": "editor"},
    {"name": "moderator", "email": "moderator@example.com", "password": p, "role": "moderator"},
    {"name": "member", "email": "member@example.com", "password": p, "role": "none"},
]}).encode()).decode())')"
  { printf 'WAGTAIL_SITE_ACCOUNTS = "%s"\n' "$accounts"; cat "$SCRIPT"; } | ddev exec -d "$APP" "${ROOT}/.venv/bin/python - $*"
}

manage() {
  ddev exec -d "$APP" "${ROOT}/.venv/bin/python manage.py $*" < /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  site_script accounts add
  exit 0
fi
if [ "${TIDY_ONLY:-}" = "1" ]; then
  site_script tidy
  exit 0
fi

# A project of this name from an earlier build goes first, with its containers and its database.
if ddev describe "$PROJECT_NAME" > /dev/null 2>&1; then
  ddev delete -Oy "$PROJECT_NAME" < /dev/null
fi
rm -rf app .venv .ready

# A generic project: no web server of DDEV's own, the database PostgreSQL 16, Node.js 24 for a suite run in the web
# container (the site itself needs none).
ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name="$PROJECT_NAME" \
  --database=postgres:16 --nodejs-version=24 < /dev/null

SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
mkdir -p .ddev/web-build
cat > .ddev/config.wagtail.yaml <<YAMLEOF
# The Wagtail Bakery demo in this project. Written by the build script of the step pack; build again rather than
# editing by hand. The web container serves no files of its own: the router sends ports 80 and 443 of the project's
# address to uWSGI (the demo's production server), which the web container runs as a daemon once the build has
# finished (.ready), with the demo's production settings, its static files served by the site (WhiteNoise) and its
# media files by uWSGI, its mail sent to the project's mail catcher.
web_extra_exposed_ports:
  - name: wagtail
    container_port: ${PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: wagtail
    command: "bash -c 'while [ ! -f ${ROOT}/.ready ]; do sleep 2; done; cd ${APP} && exec ${ROOT}/.venv/bin/uwsgi --http-socket :${PORT} --master --workers 2 --threads 4 --http-keepalive --http-auto-chunked --lazy-apps --wsgi-env-behaviour holy --virtualenv ${ROOT}/.venv --static-map /media/=${APP}/bakerydemo/media/ --wsgi-file bakerydemo/wsgi.py --die-on-term'"
    directory: ${ROOT}
web_environment:
  - DJANGO_SETTINGS_MODULE=bakerydemo.settings.container
  - DATABASE_URL=postgres://db:db@db:5432/db
  - DJANGO_SECRET_KEY=${SECRET_KEY}
  - PRIMARY_HOST=${HOST}
  - PYTHONUNBUFFERED=1
YAMLEOF
cat > .ddev/web-build/Dockerfile.wagtail <<DOCKEREOF
# Python for the Wagtail site, in the web image: uv (${UV_VERSION}), and the Python the site runs on (${PYTHON_VERSION}),
# installed by uv. Written by the build script of the step pack.
ENV UV_PYTHON_INSTALL_DIR=/opt/python
# The packages are copied into the project's virtual environment (the cache is on another file system).
ENV UV_LINK_MODE=copy
RUN arch="\$(uname -m)" \\
    && curl -sSfL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-\${arch}-unknown-linux-gnu.tar.gz" \\
       | tar -xz --strip-components=1 -C /usr/local/bin \\
    && uv python install ${PYTHON_VERSION} \\
    && chmod -R a+rX /opt/python
DOCKEREOF

ddev start -y < /dev/null

# The demo, at its commit.
echo "Getting the Wagtail Bakery demo at ${BAKERYDEMO_REF}."
mkdir -p app
curl -sSfL "https://codeload.github.com/wagtail/bakerydemo/tar.gz/${BAKERYDEMO_REF}" | tar -xz --strip-components=1 -C app

# The packages of the demo (its base requirements), and of its production settings: its PostgreSQL driver, the
# server of its static files (WhiteNoise: the 8.1 demo lists it in its base requirements, the 7.4 one in its production
# ones) and its production server, in a virtual environment of the project.
ddev exec "uv venv --clear --seed --python ${PYTHON_VERSION} ${ROOT}/.venv && uv pip install --python ${ROOT}/.venv/bin/python -r ${APP}/requirements/base.txt 'psycopg[binary]>=3.3,<3.4' 'whitenoise>=6.11,<7' 'pyuwsgi>=2.0.30,<2.1'" < /dev/null

# The settings of the containers, the database and the demo content, the static files, the site's address.
site_script settings
manage migrate --noinput
manage load_initial_data
manage collectstatic --noinput -v 0
site_script site "$HOST"
site_script accounts add

# The server starts once the site is in place.
ddev exec "touch ${ROOT}/.ready" < /dev/null
ddev exec "supervisorctl restart webextradaemons:wagtail" < /dev/null
code=""
for attempt in $(seq 1 90); do
  code="$(ddev exec "curl -s -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' http://127.0.0.1:${PORT}/admin/login/" < /dev/null 2>/dev/null | tr -d '\r' || true)"
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "The site did not answer; the end of its server's log:" >&2
  ddev exec "supervisorctl tail webextradaemons:wagtail stderr" < /dev/null >&2 || true
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
VERSIONS="$(ddev exec "${ROOT}/.venv/bin/python -c 'import wagtail, django; print(\"Wagtail\", wagtail.__version__, \"on Django\", django.get_version())'" < /dev/null | tr -d '\r')"
echo "Built the Wagtail Bakery demo (${VERSIONS}) at ${SITE_URL}, its admin at ${SITE_URL}/admin/, its mail at ${SITE_URL}:8026."
