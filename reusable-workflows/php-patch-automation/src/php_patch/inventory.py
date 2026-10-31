"""Read-only inventory adapters and fixture loader."""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from php_patch.models import Workload

def _from_mapping(item: dict[str, Any], source: str) -> Workload:
    tags, props = item.get("tags") or {}, item.get("properties") or {}
    return Workload(
        resource_id=str(item.get("resource_id") or item.get("id") or "unknown"),
        cloud=str(item.get("cloud") or source),
        resource_type=str(item.get("resource_type") or item.get("type") or "unknown"),
        bu=str(item.get("bu") or tags.get("BU") or "unassigned"),
        application=str(item.get("application") or tags.get("Application") or "unknown"),
        environment=str(item.get("environment") or tags.get("Environment") or "unknown"),
        operating_system=item.get("operating_system") or props.get("osType"),
        php_version=item.get("php_version"),
        patch_ring=str(item.get("patch_ring") or tags.get("PatchRing") or "unassigned"),
        region=item.get("region") or item.get("location"), source=source)

def load_fixtures(directory: Path) -> list[Workload]:
    result: list[Workload] = []
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data if isinstance(data, list) else data.get("items", [])
        result.extend(_from_mapping(item, "fixtures") for item in items)
    return result

def export_json(workloads: list[Workload]) -> str:
    return json.dumps([item.to_dict() for item in workloads], indent=2, sort_keys=True)

def discover_aws_ssm(region: str) -> list[Workload]:
    """Read managed-node inventory only; does not execute commands."""
    import boto3
    client = boto3.client("ssm", region_name=region)
    result: list[Workload] = []
    for page in client.get_paginator("describe_instance_information").paginate():
        for item in page.get("InstanceInformationList", []):
            result.append(Workload(resource_id=item["InstanceId"], cloud="aws",
                resource_type="ssm-managed-instance", bu="unassigned", application="unknown",
                environment="unknown", operating_system=item.get("PlatformName"),
                patch_ring="unassigned", region=region, source="aws-ssm"))
    return result

def discover_azure_resource_graph(subscription_ids: list[str]) -> list[Workload]:
    """Read Azure VM metadata; does not discover guest PHP packages."""
    from azure.identity import DefaultAzureCredential
    from azure.mgmt.resourcegraph import ResourceGraphClient
    from azure.mgmt.resourcegraph.models import QueryRequest
    client = ResourceGraphClient(DefaultAzureCredential())
    query = """Resources | where type =~ 'microsoft.compute/virtualmachines'
| project id, name, type, location, tags, properties"""
    response = client.resources(QueryRequest(subscriptions=subscription_ids, query=query))
    return [_from_mapping(item, "azure-resource-graph") for item in response.data]
