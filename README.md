# Botium Connector for Nuance

[![NPM](https://nodei.co/npm/botium-connector-nuance.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-nuance/)

[![npm version](https://badge.fury.io/js/botium-connector-nuance.svg)](https://badge.fury.io/js/botium-connector-nuance)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Nuance chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles ? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works?
Botium uses the [Nuance API](https://docs.nuance.com/mix/apis/) to connect to your chatbot.

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements

* __Node.js and NPM__
* a deployed __Nuance chatbot__
* a __project directory__ on your workstation to hold test cases and Botium configuration
## Install Botium and Nuance Webhook Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-nuance
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-nuance
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting your Nuance chatbot to Botium

1. Fill the mandatory capabilities of _botium.json_ file:
   1. NUANCE_CLIENT_ID
   2. NUANCE_CLIENT_SECRET
   3. NUANCE_CONTEXT_TAG
   4. NUANCE_CHANNEL
2. Nlp analytics (It slows down the communication, so it is not enabled as default):
   1. Enable it with NUANCE_NLP_ANALYTICS_ENABLE capability
3. In order to use downloader/uploader:
   1. [Generate service account](https://docs.nuance.com/mix/apis/mix-api/authorization/authorization_client_credentials/#generate-service-credentials-for-mixapi)
   2. If it is not visible to you, then please [ask nuance for permissions](https://docs.nuance.com/mix/apis/mix-api/authorization/authorization_client_credentials/#obtain-a-service-account)
   3. Setup the following capabilities:
      1. NUANCE_API_URL
      2. NUANCE_ADMIN_CLIENT_ID
      3. NUANCE_ADMIN_CLIENT_SECRET
      4. NUANCE_PROJECT_ID

Sample _botium.json_ in your working directory:

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "nuance",
      "NUANCE_CLIENT_ID": "...",
      "NUANCE_OAUTH_URL": "...",
      "NUANCE_CLIENT_SECRET": "...",
      "NUANCE_CONTEXT_TAG": "...",
      "NUANCE_CHANNEL": "...",
      "NUANCE_NLP_ANALYTICS_ENABLE": true,
      "NUANCE_API_URL": "...",
      "NUANCE_ADMIN_CLIENT_ID": "...",
      "NUANCE_ADMIN_CLIENT_SECRET": "...",
      "NUANCE_PROJECT_ID": "..."
    }
  }
}

```
Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __nuance__ to activate this connector.

### NUANCE_CLIENT_ID, NUANCE_CLIENT_SECRET
[Nuance client id, and client secret](https://docs.nuance.com/mix/tasks/authorize/authentication_overview/#client-credentials)

### NUANCE_CONTEXT_TAG
[Nuance context tag](https://docs.nuance.com/mix/tasks/deploy/applications/#set-up-a-new-configuration)

### NUANCE_CHANNEL
[Nuance channel](https://docs.nuance.com/mix/tasks/projects/manage/targets/#channel-settings)

### NUANCE_LANGUAGE
Language of the chatbot. A chatbot can be multi lingual, but the communication is bound to one dedicated one.

Optional.

Default: en-US

### NUANCE_NLP_ANALYTICS_ENABLE
Capability to enable nlp analytics.

Optional.

Default: false

### NUANCE_API_URL
[Nuance API url](https://docs.nuance.com/mix/overview/mix-geographies/)

Optional. Only required for downloader/uploader.
Default: https://mix.api.nuance.com/

### NUANCE_ADMIN_CLIENT_ID, NUANCE_ADMIN_CLIENT_SECRET
Credentials for [Nuance Service Account](https://docs.nuance.com/mix/apis/mix-api/authorization/authorization_client_credentials/#generate-service-credentials-for-mixapi)

Optional. Only required for downloader/uploader.

### NUANCE_PROJECT_ID
The Nuance Project ID.

Optional. Only required for downloader/uploader.

### NUANCE_OAUTH_URL
[Nuance Oauth url](https://docs.nuance.com/mix/overview/mix-geographies/)

Default: https://auth.crt.nuance.com/oauth2/token

### NUANCE_DLG_ENDPOINT
[Nuance NLU gRPC endpoint](https://docs.nuance.com/mix/overview/mix-geographies/)

Default: nlu.api.nuance.com:443

### NUANCE_NLU_ENDPOINT
[Nuance NLU gRPC endpoint](https://docs.nuance.com/mix/overview/mix-geographies/)

Default: dlg.api.nuance.com:443

### NUANCE_OAUTH_MAX_RETRIES
Oauth max retries. It is to deal with for Nuance Authorization rate limit: 50 requests/minute per IP address

Default: 6

### NUANCE_OAUTH_RETRY_DELAY_SEC
Oauth retry delay in sec. It is to deal with for Nuance Authorization rate limit: 50 requests/minute per IP address

Default: 10

### NUANCE_LIBRARY
[Nuance Library]((https://docs.nuance.com/mix/apis/dialog-grpc/v1/nuance-dlg-service/#selector)).

Default: default

### NUANCE_SESSION_ID
[Nuance session timeout](https://docs.nuance.com/mix/apis/dialog-grpc/v1/client-app-dlg/#start-a-new-session) in sec.

Default: not set (generated by Nuance)

### NUANCE_SESSION_TIMEOUT_SEC
[Nuance session timeout](https://docs.nuance.com/mix/apis/dialog-grpc/v1/client-app-dlg/#start-a-new-session) in sec.

Default: 900

### NUANCE_USER_ID

[Nuance user id](https://docs.nuance.com/mix/apis/dialog-grpc/v1/client-app-dlg/#start-a-new-session) in sec.

Default: not set

### NUANCE_CLIENT_DATA

[Client data to inject into the Nuance Event Logs](https://docs.nuance.com/mix/apis/event_logs/inject-content/#client-data)

### NUANCE_SUPPRESS_LOG_USER_DATA
Capability to turn off Nuance Event Logs

### NUANCE_INITIAL_CONTEXT
[Initial context (session data)](https://docs.nuance.com/mix/apis/dialog-grpc/v1/ref-topics/data-exchange-resources/reference_exchanging_session_data/
) in JSON format

### NUANCE_SKIP_WELCOME_MESSAGE
Turning off welcome message check can speed up the time of the conversation.

Default: false

### NUANCE_NLU_ENTITY_VALUE_MODE
Configure how Nuance entities are mapped to Botium entities

Possible values:
* __FORCE_LITERAL__ Nuance entities are mapped as string
* __FORCE_STRUCT__ Nuance entities are mapped as string
* __LITERAL_FOR_COMPLEX__ Flat Nuance entities are mapped as string, complex as JSON

## Open Issues and Restrictions
* Voice, and IVR chatbots are not supported (just text based)
* On premise installation of a Nuance chatbot might not work.
* [Transfer action](https://docs.nuance.com/mix/apis/dialog-grpc/v1/ref-topics/response-actions/reference_transfer_actions/) is not supported: 
* [Dialog events](https://docs.nuance.com/mix/apis/dialog-grpc/v1/nuance-dlg-service/#dialogevent) are not supported
* [Continue actions](https://docs.nuance.com/mix/apis/dialog-grpc/v1/ref-topics/response-actions/reference_continue_actions/) are not supported