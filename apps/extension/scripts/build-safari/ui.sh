# =============================================================================
# UI - Colors, TTY detection, and full-screen display functions
# =============================================================================

# Colors
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
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

# Draw horizontal line at row with specific characters
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

# Draw a text row with borders (content is left-aligned, supports color codes)
draw_row() {
    local row=$1
    local content="$2"
    local content_width=$((TERM_WIDTH - 4))  # 2 for borders, 2 for padding
    
    tput cup $row 0
    printf "║ "
    # Use %b to interpret escape sequences for colors
    printf "%b" "$content"
    # Fill remaining space and add right border
    tput cup $row $((TERM_WIDTH - 1))
    printf "║"
}

# Draw a text row with content on left and right
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
# Full-Screen Display Functions
# =============================================================================

init_display() {
    [ "$IS_TTY" = false ] && return
    
    detect_terminal_size
    
    # Header: top + title + sep + steps + sep + "Output" + sep = 6 + TOTAL_STEPS
    HEADER_LINES=$((TOTAL_STEPS + 6))
    OUTPUT_START_LINE=$((HEADER_LINES))
    
    if [ $TERM_HEIGHT -lt $((HEADER_LINES + 5)) ]; then
        IS_TTY=false
        return
    fi
    
    tput civis 2>/dev/null || true
    tput clear
    
    draw_full_frame
    
    # Set scrolling region for output content (between output header and bottom border)
    tput csr $OUTPUT_START_LINE $((TERM_HEIGHT - 2))
    tput cup $OUTPUT_START_LINE 0
}

draw_full_frame() {
    # Top border
    draw_hline 0 "╔" "═" "╗"
    
    # Title row - use simple ASCII for calculation
    local title="Stream Keys - Safari Extension Build"
    draw_row_lr 1 "$title" "$BUILD_DESCRIPTION"
    
    # Separator
    draw_hline 2 "╠" "═" "╣"
    
    # Step rows
    for i in $(seq 0 $((TOTAL_STEPS - 1))); do
        draw_step_line $((i + 3)) $i "pending"
    done
    
    # Separator before output
    draw_hline $((TOTAL_STEPS + 3)) "╠" "═" "╣"
    
    # Output label
    draw_row $((TOTAL_STEPS + 4)) "${DIM}Output${NC}"
    
    # Separator after output label  
    draw_hline $((TOTAL_STEPS + 5)) "╠" "═" "╣"
    
    # Output area - empty rows with borders
    for row in $(seq $OUTPUT_START_LINE $((TERM_HEIGHT - 2))); do
        draw_row $row ""
    done
    
    # Bottom border
    draw_hline $((TERM_HEIGHT - 1)) "╚" "═" "╝"
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
        ok)      status_text="OK"; status_color="$GREEN" ;;
        fail)    status_text="FAIL"; status_color="$RED" ;;
        running) status_text="RUN"; status_color="$YELLOW" ;;
        *)       status_text="..."; status_color="$DIM" ;;
    esac
    
    local left_text="[$step_num/$TOTAL_STEPS] $name"
    local right_text=$(printf "%b%s%b" "$status_color" "$status_text" "$NC")
    
    # Calculate positions
    local left_len=${#left_text}
    local status_display_len=${#status_text}
    local space=$((TERM_WIDTH - 4 - left_len - status_display_len))
    
    tput cup $row 0
    printf "║ %s" "$left_text"
    printf "%${space}s" ""
    printf "%b%s%b ║" "$status_color" "$status_text" "$NC"
}

update_step_status() {
    local step_idx=$1
    local status=$2
    [ "$IS_TTY" = false ] && return
    
    tput sc
    draw_step_line $((step_idx + 3)) $step_idx "$status"
    tput rc
}

# Redraw borders for the output area (called after each output line)
redraw_output_borders() {
    [ "$IS_TTY" = false ] && return
    
    tput sc
    
    # Only draw left border on the LAST row (where new blank line scrolls in)
    # Other rows already have ║ as part of their content from run()
    tput cup $((TERM_HEIGHT - 2)) 0
    printf "║"
    
    # Draw right borders on all rows
    for row in $(seq $OUTPUT_START_LINE $((TERM_HEIGHT - 2))); do
        tput cup $row $((TERM_WIDTH - 1))
        printf "║"
    done
    
    # Redraw bottom border
    draw_hline $((TERM_HEIGHT - 1)) "╚" "═" "╝"
    
    tput rc
}

cleanup_display() {
    [ "$IS_TTY" = false ] && return
    
    tput csr 0 $((TERM_HEIGHT - 1))
    tput cnorm 2>/dev/null || true
    tput cup $((TERM_HEIGHT - 1)) 0
    echo ""
}

# =============================================================================
# Summary Display
# =============================================================================

print_summary() {
    echo ""
    echo -e "${CYAN}=== Build Summary ===${NC}"
    for i in "${!STEP_NAMES[@]}"; do
        local step_num=$((i + 1))
        local name="${STEP_NAMES[$i]}"
        local status="${STEP_STATUSES[$i]}"
        local status_text
        
        case "$status" in
            ok)      status_text="${GREEN}[ OK ]${NC}" ;;
            fail)    status_text="${RED}[FAIL]${NC}" ;;
            running) status_text="${YELLOW}[????]${NC}" ;;
            *)       status_text="${DIM}[SKIP]${NC}" ;;
        esac
        
        printf "[%2d/%d] %-45s %b\n" "$step_num" "$TOTAL_STEPS" "$name" "$status_text"
    done
    echo ""
}
