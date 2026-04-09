variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "app_name" {
  type    = string
  default = "blockchain-worker"
}

variable "container_port" {
  type    = number
  default = 80
}

variable "task_cpu" {
  type    = string
  default = "512"
}

variable "task_memory" {
  type    = string
  default = "1024"
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "blockchain_rpc_url_secret_arn" {
  type      = string
  sensitive = true
}

variable "private_key_secret_arn" {
  type      = string
  sensitive = true
}

variable "contract_address" {
  type = string
}

variable "worker_poll_interval" {
  type    = string
  default = "5000"
}

variable "queue_name" {
  type    = string
  default = "blockchain_tasks"
}

variable "user_queue_name" {
  type    = string
  default = "user:registration:queue"
}

variable "complaint_queue_name" {
  type    = string
  default = "complaint:blockchain:queue"
}

variable "metadata_sync_queue" {
  type    = string
  default = "blockchain:metadata:queue"
}

variable "max_retries" {
  type    = string
  default = "5"
}

variable "max_tx_retries" {
  type    = string
  default = "3"
}

variable "base_retry_delay_ms" {
  type    = string
  default = "1000"
}

variable "max_retry_delay_ms" {
  type    = string
  default = "30000"
}

variable "backend_sync_url" {
  type    = string
  default = ""
}

variable "backend_sync_token_secret_arn" {
  type      = string
  default   = ""
  sensitive = true
}

variable "emit_verification_code_tx" {
  type    = string
  default = "true"
}

variable "redis_url_secret_arn" {
  type      = string
  sensitive = true
}

variable "pinata_api_key_secret_arn" {
  type      = string
  sensitive = true
}

variable "pinata_api_secret_secret_arn" {
  type      = string
  sensitive = true
}

variable "pinata_jwt_secret_arn" {
  type      = string
  sensitive = true
}
