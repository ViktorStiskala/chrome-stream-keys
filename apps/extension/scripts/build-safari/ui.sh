# =============================================================================
# UI - Colors, TTY detection, and fixed header with scrolling output
# =============================================================================

# Colors
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# TTY detection
IS_TTY=false
TERM_WIDTH=80
TERM_HEIGHT=24
if [ -t 1 ]; then
    IS_TTY=true
fi

# Track layout dimensions
HEADER_LINES=0
OUTPUT_START_LINE=0

# Column widths (fixed)
COL_STATUS_WIDTH=11   # " [RUNNING] "
COL_STEP_WIDTH=7      # " [1/7] "

# =============================================================================
# Terminal Size Detection
# =============================================================================

detect_terminal_size() {
    if command -v stty &>/dev/null; then
        local size=$(stty size 2>/dev/null)
        if [ -n "$size" ]; then
            TERM_HEIGHT=$(echo "$size" | cut -d' ' -f1)
            TERM_WIDTH=$(echo "$size" | cut -d' ' -f2)
            return
        fi
    fi
    
    if command -v tput &>/dev/null; then
        TERM_WIDTH=$(tput cols 2>/dev/null || echo 80)
        TERM_HEIGHT=$(tput lines 2>/dev/null || echo 24)
        return
    fi
    
    TERM_WIDTH=${COLUMNS:-80}
    TERM_HEIGHT=${LINES:-24}
}

# =============================================================================
# Drawing Primitives
# =============================================================================

# Draw a horizontal line without columns (for title area)
draw_hline() {
    local row=$1
    local left_char="$2"
    local fill_char="$3"
    local right_char="$4"
    
    tput cup $row 0
    printf "%s" "$left_char"
    for ((i=1; i<TERM_WIDTH-1; i++)); do
        printf "%s" "$fill_char"
    done
    printf "%s" "$right_char"
}

# Draw a horizontal line with column separators
draw_hline_cols() {
    local row=$1
    local left_char="$2"
    local fill_char="$3"
    local col_char="$4"
    local right_char="$5"
    
    local details_width=$((TERM_WIDTH - COL_STATUS_WIDTH - COL_STEP_WIDTH - 4))
    
    tput cup $row 0
    printf "%s" "$left_char"
    # Status column
    for ((i=0; i<COL_STATUS_WIDTH; i++)); do
        printf "%s" "$fill_char"
    done
    printf "%s" "$col_char"
    # Step column
    for ((i=0; i<COL_STEP_WIDTH; i++)); do
        printf "%s" "$fill_char"
    done
    printf "%s" "$col_char"
    # Details column
    for ((i=0; i<details_width; i++)); do
        printf "%s" "$fill_char"
    done
    printf "%s" "$right_char"
}

draw_row_lr() {
    local row=$1
    local left="$2"
    local right="$3"
    local left_len=${#left}
    local right_len=${#right}
    local space=$((TERM_WIDTH - 4 - left_len - right_len))
    
    tput cup $row 0
    printf "║ %s" "$left"
    printf "%${space}s" ""
    printf "%s ║" "$right"
}

# =============================================================================
# Fixed Header Display with Scrolling Region
# =============================================================================

init_display() {
    [ "$IS_TTY" = false ] && return
    
    detect_terminal_size
    
    # Header structure:
    # Row 0: Top border
    # Row 1: Title row
    # Row 2: Column separator (introduces columns)
    # Row 3: Column headers (bold)
    # Row 4: Header separator
    # Row 5 to 5+TOTAL_STEPS-1: Step rows
    # Row 5+TOTAL_STEPS: Bottom border
    HEADER_LINES=$((TOTAL_STEPS + 6))
    OUTPUT_START_LINE=$((HEADER_LINES))
    
    # Need enough space for header + some output
    if [ $TERM_HEIGHT -lt $((HEADER_LINES + 5)) ]; then
        IS_TTY=false
        return
    fi
    
    tput civis 2>/dev/null || true
    tput clear
    
    draw_header
    
    # Set scrolling region: output area only (below header)
    # This keeps the header fixed while output scrolls
    tput csr $OUTPUT_START_LINE $((TERM_HEIGHT - 1))
    tput cup $OUTPUT_START_LINE 0
}

draw_header() {
    local details_width=$((TERM_WIDTH - COL_STATUS_WIDTH - COL_STEP_WIDTH - 4))
    
    # Row 0: Top border (no columns yet)
    draw_hline 0 "╔" "═" "╗"
    
    # Row 1: Title row
    local title="Stream Keys - Safari Extension Build"
    draw_row_lr 1 "$title" "$BUILD_DESCRIPTION"
    
    # Row 2: Separator that introduces columns
    draw_hline_cols 2 "╠" "═" "╦" "╣"
    
    # Row 3: Column headers (bold)
    tput cup 3 0
    printf "║ %b%-9s%b ║ %b%-5s%b ║ %b%-*s%b ║" \
        "$BOLD" "Status" "$NC" \
        "$BOLD" "Step" "$NC" \
        "$BOLD" "$((details_width - 2))" "Details" "$NC"
    
    # Row 4: Header separator
    draw_hline_cols 4 "╠" "═" "╬" "╣"
    
    # Step rows (starting at row 5)
    for i in $(seq 0 $((TOTAL_STEPS - 1))); do
        draw_step_line $((i + 5)) $i "pending"
    done
    
    # Bottom border
    draw_hline_cols $((TOTAL_STEPS + 5)) "╚" "═" "╩" "╝"
}

draw_step_line() {
    local row=$1
    local step_idx=$2
    local status=$3
    
    local step_num=$((step_idx + 1))
    local name="${STEP_NAMES[$step_idx]:-...}"
    local status_text
    local status_color
    
    case "$status" in
        ok)      status_text="[SUCCESS]"; status_color="$GREEN" ;;
        fail)    status_text="[FAILED ]"; status_color="$RED" ;;
        running) status_text="[RUNNING]"; status_color="$YELLOW" ;;
        *)       status_text="[PENDING]"; status_color="$DIM" ;;
    esac
    
    local step_text="[$step_num/$TOTAL_STEPS]"
    local details_width=$((TERM_WIDTH - COL_STATUS_WIDTH - COL_STEP_WIDTH - 4))
    
    tput cup $row 0
    printf "║ %b%-9s%b ║ %-5s ║ %-*s ║" \
        "$status_color" "$status_text" "$NC" \
        "$step_text" \
        "$((details_width - 2))" "$name"
}

update_step_status() {
    local step_idx=$1
    local status=$2
    [ "$IS_TTY" = false ] && return
    
    # Save cursor position
    tput sc
    
    # Temporarily reset scrolling region to access header
    tput csr 0 $((TERM_HEIGHT - 1))
    
    # Update the step line (step rows start at row 5)
    draw_step_line $((step_idx + 5)) $step_idx "$status"
    
    # Restore scrolling region
    tput csr $OUTPUT_START_LINE $((TERM_HEIGHT - 1))
    
    # Restore cursor position
    tput rc
}

cleanup_display() {
    [ "$IS_TTY" = false ] && return
    
    # Reset scrolling region to full screen
    tput csr 0 $((TERM_HEIGHT - 1))
    tput cnorm 2>/dev/null || true
    tput cup $((TERM_HEIGHT - 1)) 0
    echo ""
}

# =============================================================================
# No-Output Indicator
# =============================================================================

# Update the step line with a "waiting" indicator
# Called from run() when command produces no output for 2+ seconds
update_no_output_indicator() {
    local elapsed=$1
    [ "$IS_TTY" = false ] && return
    
    local step_idx=$((CURRENT_STEP - 1))
    local row=$((step_idx + 5))
    local step_num=$CURRENT_STEP
    local name="${STEP_NAMES[$step_idx]:-...}"
    
    # Sanity check for race conditions - show generic indicator for unreasonable values
    local indicator
    if [ $elapsed -lt 0 ] || [ $elapsed -gt 10000 ]; then
        indicator=" [Waiting: ...]"
    else
        indicator=" [Waiting: ${elapsed}s]"
    fi
    
    local status_text="[RUNNING]"
    local status_color="$YELLOW"
    
    local step_text="[$step_num/$TOTAL_STEPS]"
    local details_width=$((TERM_WIDTH - COL_STATUS_WIDTH - COL_STEP_WIDTH - 4))
    local name_with_indicator="${name}${indicator}"
    
    # Truncate if too long
    local max_name_len=$((details_width - 2))
    if [ ${#name_with_indicator} -gt $max_name_len ]; then
        name_with_indicator="${name_with_indicator:0:$((max_name_len - 3))}..."
    fi
    
    # Save cursor position
    tput sc
    
    # Temporarily reset scrolling region to access header
    tput csr 0 $((TERM_HEIGHT - 1))
    
    # Draw the step line with indicator
    tput cup $row 0
    printf "║ %b%-9s%b ║ %-5s ║ %b%-*s%b ║" \
        "$status_color" "$status_text" "$NC" \
        "$step_text" \
        "$DIM" "$((details_width - 2))" "$name_with_indicator" "$NC"
    
    # Restore scrolling region
    tput csr $OUTPUT_START_LINE $((TERM_HEIGHT - 1))
    
    # Restore cursor position
    tput rc
}

# Clear the no-output indicator by redrawing the step line normally
clear_no_output_indicator() {
    [ "$IS_TTY" = false ] && return
    
    local step_idx=$((CURRENT_STEP - 1))
    
    # Save cursor position
    tput sc
    
    # Temporarily reset scrolling region to access header
    tput csr 0 $((TERM_HEIGHT - 1))
    
    # Redraw step line without indicator
    draw_step_line $((step_idx + 5)) $step_idx "running"
    
    # Restore scrolling region
    tput csr $OUTPUT_START_LINE $((TERM_HEIGHT - 1))
    
    # Restore cursor position
    tput rc
}

# =============================================================================
# Summary Display
# =============================================================================

print_summary() {
    echo ""
    echo -e "${CYAN}=== Build Summary ===${NC}"
    
    # Calculate max step name length for proper alignment
    local max_len=0
    for name in "${STEP_NAMES[@]}"; do
        local len=${#name}
        [ $len -gt $max_len ] && max_len=$len
    done
    
    for i in "${!STEP_NAMES[@]}"; do
        local step_num=$((i + 1))
        local name="${STEP_NAMES[$i]}"
        local status="${STEP_STATUSES[$i]}"
        local status_text
        
        case "$status" in
            ok)      status_text="${GREEN}[SUCCESS]${NC}" ;;
            fail)    status_text="${RED}[FAILED ]${NC}" ;;
            running) status_text="${YELLOW}[RUNNING]${NC}" ;;
            *)       status_text="${DIM}[PENDING]${NC}" ;;
        esac
        
        printf "%b [%d/%d] %-${max_len}s\n" "$status_text" "$step_num" "$TOTAL_STEPS" "$name"
    done
    echo ""
}
