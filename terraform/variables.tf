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

variable "blockchain_rpc_url" {
  type      = string
  sensitive = true
}

variable "private_key" {
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

variable "redis_url" {
  type      = string
  sensitive = true
}

variable "pinata_api_key" {
  type      = string
  sensitive = true
}

variable "pinata_api_secret" {
  type      = string
  sensitive = true
}

variable "pinata_jwt" {
  type      = string
  sensitive = true
}
