#!/usr/bin/env python3
"""Lelu CLI for viewing audit logs and managing policies."""

import asyncio
import os
import sys
from datetime import datetime
from typing import Optional

import httpx

from auth_pe.client import LeluClient
from auth_pe.models import (
    ListAuditEventsRequest,
    ListPoliciesRequest,
    GetPolicyRequest,
    UpsertPolicyRequest,
    DeletePolicyRequest,
)


def print_help() -> None:
    """Print CLI help information."""
    print("""
Lelu CLI

Usage:
  lelu audit-log         View recent audit events from the platform
  lelu policies          Manage authorization policies
  lelu help              Show this help

Commands:
  audit-log              View audit trail and authorization events
  policies list          List all policies
  policies get <name>    Get a specific policy
  policies set <name> <file>  Create or update a policy from file
  policies delete <name> Delete a policy

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (default: http://localhost:9091)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_TENANT_ID          Tenant ID (default: default)
  LELU_AUDIT_LIMIT        Number of events to fetch (default: 20)

Examples:
  lelu audit-log                              # View recent audit events
  lelu policies list                          # List all policies
  lelu policies get auth                      # View the "auth" policy
  lelu policies set auth ./auth.rego          # Create/update policy from file
  LELU_TENANT_ID=prod lelu policies list      # Use different tenant
""")


async def show_audit_log() -> None:
    """Fetch and display audit events."""
    base_url = os.getenv("LELU_PLATFORM_URL", "http://localhost:9091")
    api_key = os.getenv("LELU_PLATFORM_API_KEY", "platform-dev-key")
    limit = int(os.getenv("LELU_AUDIT_LIMIT", "20"))
    
    print(f"Fetching audit log from {base_url}...")
    
    async with LeluClient(base_url=base_url, api_key=api_key) as lelu:
        try:
            # First check if the service is reachable
            try:
                health_response = await lelu._client.get("/healthz", timeout=3.0)
                if health_response.status_code != 200:
                    raise httpx.HTTPError("Service not healthy")
            except (httpx.HTTPError, httpx.ConnectError, httpx.TimeoutException):
                print("❌ Lelu platform service is not running or not reachable")
                print("")
                print("To view audit logs, you need the Lelu platform service running.")
                print("")
                print("🚀 Quick start with Docker:")
                print("  git clone https://github.com/lelu-auth/lelu.git")
                print("  cd lelu")
                print("  docker compose up -d")
                print("  lelu audit-log  # Try again")
                print("")
                print("🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:")
                print("  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu audit-log")
                print("")
                print(f"💡 Currently trying to connect to: {base_url}")
                sys.exit(1)
            
            result = await lelu.list_audit_events(
                ListAuditEventsRequest(limit=limit)
            )
            
            if not result.events:
                print("📋 No audit events found.")
                print("")
                print("This could mean:")
                print("- No authorization requests have been made yet")
                print("- The audit data is stored elsewhere")
                print("- Filters are too restrictive")
                return
            
            print(f"\n📊 Audit Log ({result.count} events, limit: {limit})")
            print("─" * 80)
            
            for event in result.events:
                timestamp = datetime.fromisoformat(event.timestamp.replace('Z', '+00:00'))
                formatted_time = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
                
                confidence = f" (confidence: {event.confidence_score:.2f})" if event.confidence_score else ""
                resource = f" on {event.resource}" if event.resource else ""
                
                print(f"[{formatted_time}] {event.actor} → {event.action}{resource}")
                print(f"  Decision: {event.decision}{confidence}")
                if event.reason:
                    print(f"  Reason: {event.reason}")
                if event.downgraded_scope:
                    print(f"  Downgraded scope: {event.downgraded_scope}")
                print(f"  Trace ID: {event.trace_id}")
                print()
            
            if result.next_cursor > 0:
                print(f"📄 Use cursor {result.next_cursor} to fetch more events.")
                
        except httpx.HTTPError as e:
            if "ECONNREFUSED" in str(e) or "ConnectError" in str(e):
                print("❌ Connection failed to Lelu platform service")
                print("")
                print("🔧 Troubleshooting steps:")
                print("1. Ensure the Lelu platform service is running")
                print("2. Check the platform URL is correct")
                print("3. Verify your network connection")
                print("4. Check if firewall is blocking the connection")
            else:
                print(f"❌ Error fetching audit log: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error fetching audit log: {e}")
            sys.exit(1)


def main() -> None:
    """Main CLI entry point."""
    command = sys.argv[1] if len(sys.argv) > 1 else "help"
    
    if command in ("help", "-h", "--help"):
        print_help()
        return
    
    if command == "audit-log":
        asyncio.run(show_audit_log())
        return
    
    if command == "policies":
        asyncio.run(show_policies())
        return
    
    print(f"Unknown command: {command}")
    print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()


async def show_policies() -> None:
    """Handle policies subcommands."""
    base_url = os.getenv("LELU_PLATFORM_URL", "http://localhost:9091")
    api_key = os.getenv("LELU_PLATFORM_API_KEY", "platform-dev-key")
    tenant_id = os.getenv("LELU_TENANT_ID", "default")
    
    if len(sys.argv) < 3:
        print("❌ Policies command is required")
        print("Usage: lelu policies <list|get|set|delete> [args...]")
        sys.exit(1)
    
    subcommand = sys.argv[2]
    
    # First check if the service is reachable
    try:
        async with httpx.AsyncClient() as client:
            health_response = await client.get(f"{base_url}/healthz", timeout=3.0)
            if health_response.status_code != 200:
                raise httpx.HTTPError("Service not healthy")
    except (httpx.HTTPError, httpx.ConnectError, httpx.TimeoutException):
        print("❌ Lelu platform service is not running or not reachable")
        print("")
        print("To manage policies, you need the Lelu platform service running.")
        print("")
        print("🚀 Quick start with Docker:")
        print("  git clone https://github.com/lelu-auth/lelu.git")
        print("  cd lelu")
        print("  docker compose up -d")
        print("  lelu policies list  # Try again")
        print("")
        print("🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:")
        print("  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu policies list")
        print("")
        print(f"💡 Currently trying to connect to: {base_url}")
        sys.exit(1)
    
    async with LeluClient(base_url=base_url, api_key=api_key) as lelu:
        try:
            if subcommand == "list":
                await list_policies(lelu, tenant_id)
            elif subcommand == "get":
                if len(sys.argv) < 4:
                    print("❌ Policy name is required")
                    print("Usage: lelu policies get <policy-name>")
                    sys.exit(1)
                policy_name = sys.argv[3]
                await get_policy(lelu, policy_name, tenant_id)
            elif subcommand == "set":
                if len(sys.argv) < 5:
                    print("❌ Policy name and file path are required")
                    print("Usage: lelu policies set <policy-name> <file-path>")
                    sys.exit(1)
                policy_name = sys.argv[3]
                file_path = sys.argv[4]
                await set_policy(lelu, policy_name, file_path, tenant_id)
            elif subcommand == "delete":
                if len(sys.argv) < 4:
                    print("❌ Policy name is required")
                    print("Usage: lelu policies delete <policy-name>")
                    sys.exit(1)
                policy_name = sys.argv[3]
                await delete_policy(lelu, policy_name, tenant_id)
            else:
                print(f"❌ Unknown policies command: {subcommand}")
                print("Available commands: list, get, set, delete")
                sys.exit(1)
                
        except httpx.HTTPError as e:
            if "ECONNREFUSED" in str(e) or "ConnectError" in str(e):
                print("❌ Connection failed to Lelu platform service")
                print("")
                print("🔧 Troubleshooting steps:")
                print("1. Ensure the Lelu platform service is running")
                print("2. Check the platform URL is correct")
                print("3. Verify your network connection")
                print("4. Check if firewall is blocking the connection")
            else:
                print(f"❌ Error: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)


async def list_policies(lelu: LeluClient, tenant_id: str) -> None:
    """List all policies."""
    print(f"Fetching policies from {lelu._client.base_url}...")
    
    result = await lelu.list_policies(ListPoliciesRequest(tenant_id=tenant_id))
    
    if not result.policies:
        print("📋 No policies found.")
        print("")
        print("This could mean:")
        print("- No policies have been created yet")
        print("- You are looking at the wrong tenant")
        print("- The policies are stored elsewhere")
        return
    
    print(f"\n📊 Policies ({result.count} total)")
    print("─" * 80)
    
    for policy in result.policies:
        created_at = datetime.fromisoformat(policy.created_at.replace('Z', '+00:00'))
        updated_at = datetime.fromisoformat(policy.updated_at.replace('Z', '+00:00'))
        
        print(f"📄 {policy.name} (v{policy.version})")
        print(f"  ID: {policy.id}")
        print(f"  Created: {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"  Updated: {updated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"  Content: {len(policy.content)} characters")
        print()


async def get_policy(lelu: LeluClient, name: str, tenant_id: str) -> None:
    """Get a specific policy."""
    print(f'Fetching policy "{name}"...')
    
    try:
        policy = await lelu.get_policy(GetPolicyRequest(name=name, tenant_id=tenant_id))
        
        created_at = datetime.fromisoformat(policy.created_at.replace('Z', '+00:00'))
        updated_at = datetime.fromisoformat(policy.updated_at.replace('Z', '+00:00'))
        
        print(f"\n📄 Policy: {policy.name} (v{policy.version})")
        print("─" * 80)
        print(f"ID: {policy.id}")
        print(f"Tenant: {policy.tenant_id}")
        print(f"Created: {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"Updated: {updated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"HMAC: {policy.hmac_sha256}")
        print()
        print("Content:")
        print("─" * 40)
        print(policy.content)
        
    except Exception as e:
        if hasattr(e, 'status') and e.status == 404:
            print(f'❌ Policy "{name}" not found')
            print("")
            print('💡 Use "lelu policies list" to see available policies')
        else:
            raise


async def set_policy(lelu: LeluClient, name: str, file_path: str, tenant_id: str) -> None:
    """Create or update a policy from file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f'Setting policy "{name}" from {file_path}...')
        
        policy = await lelu.upsert_policy(UpsertPolicyRequest(
            name=name,
            content=content,
            tenant_id=tenant_id
        ))
        
        updated_at = datetime.fromisoformat(policy.updated_at.replace('Z', '+00:00'))
        
        print(f'✅ Policy "{name}" saved successfully')
        print(f"  ID: {policy.id}")
        print(f"  Version: {policy.version}")
        print(f"  Updated: {updated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"  Content: {len(content)} characters")
        
    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        sys.exit(1)
    except PermissionError:
        print(f"❌ Permission denied reading file: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)


async def delete_policy(lelu: LeluClient, name: str, tenant_id: str) -> None:
    """Delete a policy."""
    print(f'Deleting policy "{name}"...')
    
    try:
        result = await lelu.delete_policy(DeletePolicyRequest(name=name, tenant_id=tenant_id))
        
        if result.deleted:
            print(f'✅ Policy "{name}" deleted successfully')
        else:
            print(f'❌ Failed to delete policy "{name}"')
            
    except Exception as e:
        if hasattr(e, 'status') and e.status == 404:
            print(f'❌ Policy "{name}" not found')
            print("")
            print('💡 Use "lelu policies list" to see available policies')
        else:
            raise