#!/bin/bash
# =============================================================================
#
# This file *MUST* be saved with executable permissions. Otherwise, Ansible
# will try to parse as a password file and display: "ERROR! Decryption failed"
#
# In usage like:
#
#    ansible-vault --vault-id ./rcplus-vault-password-aws-ssm-client.sh view some_encrypted_file
#
# --vault-id will call this script like:
#
#    rcplus-vault-password-aws-ssm-client.sh
#
# That will retrieve the password from the AWS SSM parameter
# named '/rcplus/devops/ansible-vault-password'. Your user/role must have the permission
# to decrypt using the alias/ssm key
#
# =============================================================================

SSM_PARAM_KEY="/rcplus/devops/ansible-vault-password"

aws ssm get-parameter --name "$SSM_PARAM_KEY" --output text --query 'Parameter.Value' --with-decrypt
