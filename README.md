# logicapps-iac
Define resources for Azure LogicApps using CDKTF and deploy using Github actions.

# Secrets in the repo
- AZURE_CLIENT_ID (service principal)
- AZURE_CLIENT_SECRET (passwd of the above)
- AZURE_SUBSCRIPTION_ID
- AZURE_TENANT_ID

# Required Azure resources
- Service principal
- Resource Group "cdktf-state-rg"
- Storage Account "cdktfstatesa"
- Storage Container "tfstate"
[logicapps-iac-cdktf-state](https://github.com/git-vphakala/logicapps-iac-cdktf-state)

# Local development
- npm install
- add providers manually (.gen - directory, which you fetch via "cdktf get" if the connection is not blocked)
- .terraform.d - directory in your home must contain azapi provider (fetch via the above get)
- az login
- in bash terminal: export ARM_SUBSCRIPTION_ID="your subscription id"

When these have been done, "cdktf deploy" deploys to Azure.

# Github actions
- deployment triggered after "git push"
- destroy manually
