# Setup Guide

## Setup guide

Use this guide to run the StarkFlow app locally.

### Prerequisites

* Node.js v18 or later.
* Access to the required API keys.

{% stepper %}
{% step %}
### Clone the repository

```bash
git clone https://github.com/0xblaize/starkflow.git
cd starkflow
```
{% endstep %}

{% step %}
### Install dependencies

```bash
npm install
```
{% endstep %}

{% step %}
### Configure environment variables

Add the required values before you start the app.

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_AVNU_API_KEY=
NEXT_PUBLIC_STARKNET_NETWORK=sepolia
SUPABASE_URL=
```
{% endstep %}

{% step %}
### Start the app

```bash
npm run dev
```
{% endstep %}
{% endstepper %}
