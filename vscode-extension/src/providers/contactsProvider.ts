import * as vscode from 'vscode';
import { MCPManager, HubSpotContact } from '../mcpManager';

/**
 * 🍌 Contacts Tree Data Provider 🍌
 * 
 * Provides HubSpot contact management in VS Code sidebar
 */

export class ContactsProvider implements vscode.TreeDataProvider<ContactItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContactItem | undefined | null | void> = new vscode.EventEmitter<ContactItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContactItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private contacts: HubSpotContact[] = [];
    private isLoading = false;

    constructor(private mcpManager: MCPManager) {
        this.loadContacts();
    }

    refresh(): void {
        this.loadContacts();
    }

    getTreeItem(element: ContactItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ContactItem): Promise<ContactItem[]> {
        if (!element) {
            // Root level - show contacts or loading/error state
            if (!this.mcpManager.isConnected()) {
                return [
                    new ContactItem(
                        'MCP Not Connected',
                        'Please check MCP connection',
                        vscode.TreeItemCollapsibleState.None,
                        'error'
                    )
                ];
            }

            if (this.isLoading) {
                return [
                    new ContactItem(
                        'Loading contacts...',
                        'Fetching from HubSpot',
                        vscode.TreeItemCollapsibleState.None,
                        'loading'
                    )
                ];
            }

            if (this.contacts.length === 0) {
                return [
                    new ContactItem(
                        'No contacts found',
                        'Try refreshing or check your HubSpot data',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    )
                ];
            }

            // Group contacts by first letter of last name or company
            const grouped = this.groupContacts(this.contacts);
            
            return Object.entries(grouped).map(([letter, contacts]) =>
                new ContactItem(
                    `${letter} (${contacts.length})`,
                    `${contacts.length} contacts`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'folder',
                    undefined,
                    contacts
                )
            );
        } else if (element.contacts) {
            // Show contacts in a group
            return element.contacts.map(contact => 
                this.createContactItem(contact)
            );
        }

        return [];
    }

    private async loadContacts(): Promise<void> {
        if (!this.mcpManager.isConnected()) {
            this.contacts = [];
            this._onDidChangeTreeData.fire();
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        try {
            this.contacts = await this.mcpManager.getContacts(100);
            console.log(`🍌 Loaded ${this.contacts.length} contacts`);
        } catch (error: any) {
            console.error('🍌 Failed to load contacts:', error.message);
            vscode.window.showErrorMessage(`Failed to load contacts: ${error.message}`);
            this.contacts = [];
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    private groupContacts(contacts: HubSpotContact[]): Record<string, HubSpotContact[]> {
        const grouped: Record<string, HubSpotContact[]> = {};

        contacts.forEach(contact => {
            let groupKey = '#';
            
            // Try to group by last name first
            if (contact.properties.lastname) {
                groupKey = contact.properties.lastname.charAt(0).toUpperCase();
            } 
            // Fall back to first name
            else if (contact.properties.firstname) {
                groupKey = contact.properties.firstname.charAt(0).toUpperCase();
            }
            // Fall back to company
            else if (contact.properties.company) {
                groupKey = contact.properties.company.charAt(0).toUpperCase();
            }

            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(contact);
        });

        // Sort each group by name
        Object.values(grouped).forEach(group => {
            group.sort((a, b) => {
                const nameA = this.getContactDisplayName(a).toLowerCase();
                const nameB = this.getContactDisplayName(b).toLowerCase();
                return nameA.localeCompare(nameB);
            });
        });

        return grouped;
    }

    private createContactItem(contact: HubSpotContact): ContactItem {
        const displayName = this.getContactDisplayName(contact);
        const description = this.getContactDescription(contact);
        
        return new ContactItem(
            displayName,
            description,
            vscode.TreeItemCollapsibleState.None,
            'person',
            contact
        );
    }

    private getContactDisplayName(contact: HubSpotContact): string {
        const { firstname, lastname, email, company } = contact.properties;
        
        if (firstname && lastname) {
            return `${firstname} ${lastname}`;
        } else if (firstname) {
            return firstname;
        } else if (lastname) {
            return lastname;
        } else if (email) {
            return email;
        } else if (company) {
            return company;
        } else {
            return `Contact ${contact.id}`;
        }
    }

    private getContactDescription(contact: HubSpotContact): string {
        const { email, company, phone } = contact.properties;
        
        const parts: string[] = [];
        
        if (company) {
            parts.push(company);
        }
        
        if (email) {
            parts.push(email);
        } else if (phone) {
            parts.push(phone);
        }
        
        return parts.join(' • ') || 'HubSpot Contact';
    }

    public async searchContacts(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Search HubSpot contacts',
            placeHolder: 'Enter name, email, or company...',
            ignoreFocusOut: true
        });

        if (!query) {
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        try {
            this.contacts = await this.mcpManager.searchContacts(query);
            vscode.window.showInformationMessage(`Found ${this.contacts.length} contacts matching "${query}"`);
        } catch (error: any) {
            console.error('🍌 Failed to search contacts:', error.message);
            vscode.window.showErrorMessage(`Search failed: ${error.message}`);
            this.contacts = [];
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    public async openContact(contactId: string): Promise<void> {
        try {
            const contact = await this.mcpManager.getContact(contactId);
            
            // Create a detailed contact view
            const contactInfo = this.formatContactDetails(contact);
            
            const doc = await vscode.workspace.openTextDocument({
                content: contactInfo,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load contact: ${error.message}`);
        }
    }

    private formatContactDetails(contact: HubSpotContact): string {
        const { properties } = contact;
        const displayName = this.getContactDisplayName(contact);
        
        return `# 🍌 HubSpot Contact: ${displayName}

## Basic Information
- **Contact ID**: ${contact.id}
- **First Name**: ${properties.firstname || 'N/A'}
- **Last Name**: ${properties.lastname || 'N/A'}
- **Email**: ${properties.email || 'N/A'}
- **Company**: ${properties.company || 'N/A'}
- **Phone**: ${properties.phone || 'N/A'}

## Timestamps
- **Created**: ${properties.createdate ? new Date(properties.createdate).toLocaleString() : 'N/A'}
- **Last Modified**: ${properties.lastmodifieddate ? new Date(properties.lastmodifieddate).toLocaleString() : 'N/A'}

## Actions
- View in HubSpot: [Open Contact](https://app.hubspot.com/contacts/contact/${contact.id})
- Update contact information
- Create new engagement
- Add to sequence

---
*Loaded via HubSpot Banana MCP at ${new Date().toLocaleString()}*
`;
    }
}

class ContactItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly contact?: HubSpotContact,
        public readonly contacts?: HubSpotContact[]
    ) {
        super(label, collapsibleState);

        this.tooltip = this.contact ? 
            `${this.label}\n${this.description}\nClick to view details` : 
            `${this.label}\n${this.description}`;
        
        this.description = this.description;
        this.iconPath = new vscode.ThemeIcon(iconName);

        if (this.contact) {
            this.contextValue = 'contact';
            this.command = {
                command: 'hubspot-banana-mcp.openContact',
                title: 'Open Contact',
                arguments: [this.contact.id]
            };
        } else if (this.contacts) {
            this.contextValue = 'contactGroup';
        }
    }
}