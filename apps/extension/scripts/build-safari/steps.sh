# =============================================================================
# Steps - Step tracking and status management
# =============================================================================

# Step tracking arrays
declare -a STEP_NAMES=()
declare -a STEP_STATUSES=()
CURRENT_STEP=0
TOTAL_STEPS=0

# Start a new step
step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    STEP_NAMES+=("$1")
    STEP_STATUSES+=("running")
    
    if [ "$IS_TTY" = true ]; then
        update_step_status $((CURRENT_STEP - 1)) "running"
    else
        echo ""
        echo -e "${CYAN}[${CURRENT_STEP}/${TOTAL_STEPS}] $1${NC}"
    fi
}

# Check previous command's exit code and update step status
# Usage: step_check [error_message]
step_check() {
    local exit_code=$?
    local msg="${1:-}"
    
    if [ $exit_code -eq 0 ]; then
        STEP_STATUSES[$((CURRENT_STEP - 1))]="ok"
        [ "$IS_TTY" = true ] && update_step_status $((CURRENT_STEP - 1)) "ok"
    else
        STEP_STATUSES[$((CURRENT_STEP - 1))]="fail"
        [ "$IS_TTY" = true ] && update_step_status $((CURRENT_STEP - 1)) "fail"
        [ -n "$msg" ] && error "$msg"
        exit $exit_code
    fi
}
