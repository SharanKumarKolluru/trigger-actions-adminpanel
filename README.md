# Trigger Actions Framework Admin Panel

A lightweight administrative UI for managing the [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework). This tool provides a streamlined management layer for administrators and developers to visualize, organize, and configure trigger logic directly in Salesforce, automating the underlying Custom Metadata deployments.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Installation

> [!IMPORTANT]
> **Prerequisite:** You must have the core [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework) installed in your org first.

### Option 1: Unlocked Package (Recommended)

- [Install in Production / Developer Org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tgL000000GLZxQAO)
- [Install in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tgL000000GLZxQAO)

### Option 2: Deploy from Source

<a href="https://githubsfdeploy.herokuapp.com?owner=shahrier&repo=trigger-actions-adminpanel&ref=main">
  <img alt="Deploy to Salesforce" src="https://raw.githubusercontent.com/afawcett/githubsfdeploy/master/deploy.png">
</a>

---

## ⚙️ Post-Installation Setup

Assign the **Trigger Actions Framework Admin** permission set to any user who needs to manage trigger configurations.

1. Go to **Setup → Users → Permission Sets**.
2. Select **Trigger Actions Framework Admin**.
3. Click **Manage Assignments** and assign to your user(s).

---

## ✨ Key Features

### 1. Unified Hierarchy View

Gain full visibility into every automation running on an object. The Admin Panel groups all Trigger Actions by their execution context—such as Before Insert or After Update—and displays them in their precise execution order.

### 2. Intelligent Filtering & Auto-Detection

Save time by browsing only the Apex classes that implement the Trigger Action interfaces. Upon selection, the tool provides full context awareness by auto-detecting and mapping the supported trigger interfaces directly to your configuration.

### 3. Developer Deep-Links & Native Automations

Inspect implementation logic directly from the UI. The "View Source" feature allows you to read the associated Apex code for both framework-managed actions and **native triggers** without switching back and forth to VS Code, providing a seamless bridge between administration and development.

### 4. Operational Agility

Instantly toggle bypasses for data loads or maintenance windows with immediate visual feedback. The UI indicates the active/disabled state of each action at a glance, making it easy to manage org-wide automations in real-time.

### 5. Automation Command Center (v2.0)

Your strategic entry point for automation governance. The Command Center provides a centralized oversight of your framework adoption, serving as the control tower for managing discovery results and initializing new SObject configurations with a single click.

### 6. Intelligent Discovery & Onboarding

Uncover hidden automation debt in seconds. The Discovery engine automatically scans your entire org for unmanaged Apex Triggers and Record-Triggered Flows, identifying exactly where native logic exists and providing a streamlined path to bring it under the framework's control.

---

## 📖 Framework Documentation

This tool is a management layer for the **Trigger Actions Framework**. For detailed documentation on how to write Action classes, complex bypass logic, or advanced framework features, please refer to the [official repository](https://github.com/mitchspano/trigger-actions-framework).

---

## 📝 Important Notes

- **Metadata Deployments**: Saving changes in the Admin Panel triggers a background metadata deployment. Changes typically take 5-10 seconds to reflect in the UI.
- **Deletion**: For security and stability, this panel does not support deleting records. Please use Salesforce Setup (Custom Metadata Types) or VS Code to remove configuration records.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests to improve the Admin Panel.

---

**Version:** 2.0.3
