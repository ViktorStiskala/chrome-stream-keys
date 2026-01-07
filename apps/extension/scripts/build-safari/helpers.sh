# =============================================================================
# Helpers - Utility functions for logging, commands, and cleanup
# =============================================================================

# Logging helpers
info() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "  ${GREEN}✓ $1${NC}"; }
error() { echo -e "  ${RED}✗ ERROR: $1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }

# Run a command with output monitoring
# Shows "(no output for Xs)" indicator when command produces no output for 2+ seconds
run() {
    # For non-TTY mode, just run the command directly
    if [ "$IS_TTY" = false ]; then
        "$@"
        return $?
    fi
    
    local output_time_file
    output_time_file=$(mktemp)
    local exit_code_file
    exit_code_file=$(mktemp)
    local monitor_pid=""
    local cmd_exit_code=0
    
    # Initialize with current time
    date +%s > "$output_time_file"
    
    # Start background monitor that handles both showing and clearing indicator
    (
        local last_elapsed=0
        local indicator_active=false
        
        while [ -f "$output_time_file" ]; do
            sleep 0.5
            
            if [ ! -f "$output_time_file" ]; then
                break
            fi
            
            local last_time
            last_time=$(cat "$output_time_file" 2>/dev/null || echo "0")
            
            # Validate last_time is a valid number (race condition protection)
            if ! [[ "$last_time" =~ ^[0-9]+$ ]]; then
                continue
            fi
            
            local now
            now=$(date +%s)
            local elapsed=$((now - last_time))
            
            # Skip unreasonable values (race condition protection)
            if [ $elapsed -lt 0 ] || [ $elapsed -gt 10000 ]; then
                continue
            fi
            
            if [ $elapsed -ge 2 ]; then
                # Show/update indicator
                if [ $elapsed -ne $last_elapsed ]; then
                    update_no_output_indicator $elapsed
                    indicator_active=true
                    last_elapsed=$elapsed
                fi
            elif [ "$indicator_active" = true ]; then
                # Clear indicator when output resumes
                clear_no_output_indicator
                indicator_active=false
                last_elapsed=0
            fi
        done
        
        # Final cleanup - clear indicator if still active
        if [ "$indicator_active" = true ]; then
            clear_no_output_indicator
        fi
    ) &
    monitor_pid=$!
    
    # Run command with output processing
    # Pipe through while loop to update timestamp on each line
    "$@" 2>&1 | while IFS= read -r line; do
        echo "$line"
        date +%s > "$output_time_file"
    done
    
    # Capture exit code from the original command (PIPESTATUS[0])
    cmd_exit_code=${PIPESTATUS[0]}
    
    # Stop monitor
    rm -f "$output_time_file"
    if [ -n "$monitor_pid" ] && kill -0 "$monitor_pid" 2>/dev/null; then
        kill "$monitor_pid" 2>/dev/null
        wait "$monitor_pid" 2>/dev/null || true
    fi
    
    # Final indicator clear (in case monitor didn't catch it)
    clear_no_output_indicator 2>/dev/null || true
    
    rm -f "$exit_code_file"
    return $cmd_exit_code
}

# Helper for notarytool commands
notarytool() {
    xcrun notarytool "$@" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID"
}

# Trap handler for errors and exit
cleanup() {
    local exit_code=$?
    
    # Mark current step as failed if we're exiting with error
    if [ $exit_code -ne 0 ] && [ $CURRENT_STEP -gt 0 ]; then
        STEP_STATUSES[$((CURRENT_STEP - 1))]="fail"
        [ "$IS_TTY" = true ] && update_step_status $((CURRENT_STEP - 1)) "fail"
    fi
    
    # Reset terminal display before printing summary
    cleanup_display
    
    print_summary
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}=== Build Complete ===${NC}"
        info "Output: $OUTPUT_PATH"
        
        if [ "$BUILD_TYPE" = "dmg" ] || [ "$BUILD_TYPE" = "rebuild-dmg" ]; then
            if [ "$SIGNED" = true ]; then
                info "The DMG is signed and notarized, ready for distribution."
            else
                info "The DMG is for local testing only (ad-hoc signed, not notarized)."
            fi
        else
            info "The package is ready for upload to App Store Connect."
            info "Upload using Transporter app or: xcrun altool --upload-app -f $OUTPUT_PATH -t macos"
        fi
    else
        echo -e "${RED}=== Build Failed ===${NC}"
    fi
    
    exit $exit_code
}
