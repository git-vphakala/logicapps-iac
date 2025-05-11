import { App, TerraformStack, TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
// import { AzurermProvider, StorageAccount, StorageContainer } from "./.gen/providers/azurerm/provider";
// import { ResourceGroup } from "./.gen/providers/azurerm/resource-group";
import { AzurermProvider } from "./.gen/providers/azurerm/provider";
import { AzapiProvider } from "./.gen/providers/azapi/provider";
import { Resource } from './.gen/providers/azapi/resource';
import { DataAzapiResourceAction } from "./.gen/providers/azapi/data-azapi-resource-action";
import { Fn } from 'cdktf';
import { Token } from 'cdktf';
import { AzurermBackend } from "cdktf";

class LogicAppStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const subscriptionId = process.env.ARM_SUBSCRIPTION_ID;
    const location = 'swedencentral';
    new AzurermProvider(this, "azurerm", { features: {}, subscriptionId:subscriptionId });
    new AzapiProvider(this, "azapi", {});

    const rg = new Resource(this, 'cdk3-rg', {
      name: 'cdk3-rg',
      type: 'Microsoft.Resources/resourceGroups@2024-07-01',
      location: location,
      parentId: `/subscriptions/${subscriptionId}`,
      body: {
        tags: {
          environment: 'dev',
        },
      },
    });

    let sa = new Resource(this, 'logicAppStorageAccount', {
      type: 'Microsoft.Storage/storageAccounts@2024-01-01',
      name: 'cdktfapplogicstoragecdk3', // must be globally unique and all lowercase
      parentId: rg.id,
      location: location,
      body: {
        sku: {
          name: 'Standard_LRS',
        },
        kind: 'StorageV2',
        properties: {
          accessTier: 'Hot', // Required for Logic Apps
          supportsHttpsTrafficOnly: true,
          allowBlobPublicAccess: false,
          minimumTlsVersion: 'TLS1_2',
        },
        tags: {
          purpose: 'logicapp',
        },
      },
    });

    new Resource(this, 'logicAppBlobContainer', {
      type: 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01',
      name: 'logicappcontainer',
      parentId: `${sa.id}/blobServices/default`, // link to blob service of storage account
      body: {
        properties: {
          publicAccess: 'None',
        },
      },
    });

    // cdktf RG, SA and the container are created separately
    new AzurermBackend(this, {
      resourceGroupName: "cdktf-state-rg",
      storageAccountName: "cdktfstatesa",
      containerName: "tfstate",
      key: "cdktf.tfstate",
    });

    // Debug: get storage account access key
    const storageKeys = new DataAzapiResourceAction(this, 'storageAccountKeys', {
      type: 'Microsoft.Storage/storageAccounts@2024-01-01',
      method: 'POST',
      action: 'listKeys',
      resourceId: sa.id,
      responseExportValues: ['keys'],
    });
    const accountKey = Fn.lookup(Fn.element(Token.asList(storageKeys.output.lookup('0')), 0), 'value', 'listKeys-failed');
    new TerraformOutput(this, 'saPrimaryKeyOutput-key', {
      value: accountKey
    });
    new TerraformOutput(this, 'saPrimaryKeyOutput-output', {
      value: storageKeys.output
    });

    const appServicePlan = new Resource(this, 'logicAppPlan', {
      type: 'Microsoft.Web/serverfarms@2024-04-01',
      name: 'logicapp-windows-plan',
      parentId: rg.id,
      location,
      body: {
        kind: 'elastic',
        sku: {
          name: 'WS1',
          tier: 'WorkflowStandard',
        },
        properties: {
          reserved: false, // false = Windows
        },
      },
    });

    // Logic App Standard (runs on Windows)
    const logicApp = new Resource(this, 'logicApp', {
      type: 'Microsoft.Web/sites@2022-09-01',
      name: 'logicapp-win-std-cdk3',
      parentId: rg.id,
      location,
      body: {
        kind: 'functionapp,workflowapp',
        properties: {
          siteConfig: {
            appSettings: [
              {
                name: 'AzureWebJobsStorage',
                value: `DefaultEndpointsProtocol=https;AccountName=${sa.name};AccountKey=${accountKey};EndpointSuffix=core.windows.net`,
              },
              {
                name: 'WEBSITE_RUN_FROM_PACKAGE',
                value: '1',
              },
              {
                name: 'FUNCTIONS_WORKER_RUNTIME',
                value: 'dotnet',
              },
              {
                name: 'FUNCTIONS_EXTENSION_VERSION',
                value: '~4',
              },
              {
                name: 'WEBSITE_NODE_DEFAULT_VERSION',
                value: '~20',
              },
            ],
          },
          serverFarmId: appServicePlan.id,
        },
      },
    });

    // Optional: Output logic app name
    new TerraformOutput(this, 'logicAppName', {
      value: logicApp.name,
    });

  }
}

const app = new App();
new LogicAppStack(app, 'cdk3');
app.synth();
