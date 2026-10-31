terraform {
  backend "s3" {
    bucket                      = "floci-tfstate-bu-12345678901"
    key                         = "BU-12345678901/dev/us-east-1/vpc/terraform.tfstate"
    region                      = "us-east-1"
    endpoint                    = "http://localhost:4566"
    dynamodb_endpoint           = "http://localhost:4566"
    dynamodb_table              = "tflock"
    access_key                  = "123456789012"
    secret_key                  = "floci-local-secret"
    skip_credentials_validation = true
    skip_region_validation      = true
    use_path_style              = true
  }
}
