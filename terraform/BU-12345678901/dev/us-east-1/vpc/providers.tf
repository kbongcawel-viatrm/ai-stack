provider "aws" {
  region     = "us-east-1"
  access_key = "123456789012"
  secret_key = "floci-local-secret"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    ec2 = "http://localhost:4566"
  }
}
