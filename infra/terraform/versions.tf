terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state. Create the bucket + lock table once, out of band, then
  # uncomment. Keeping state local is fine for a first `plan` but not for teams.
  # backend "s3" {
  #   bucket         = "sweet-treats-tfstate"
  #   key            = "app/terraform.tfstate"
  #   region         = "eu-west-1"
  #   dynamodb_table = "sweet-treats-tflock"
  #   encrypt        = true
  # }
}
