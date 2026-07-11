package com.baseball

// Global app-wide constants
object Constants {
    // Navigation Tabs
    const val TAB_DASHBOARD = "dashboard"
    const val TAB_SCORER = "scorer"
    const val TAB_TEAMS = "teams"
    const val TAB_LEAGUES = "leagues"
    const val TAB_BOXSCORE = "boxscore"
    const val TAB_LOGIN = "login"
    const val TAB_REGISTER = "register"

    // Storage Keys
    const val KEY_LOCAL_GAME_STATE = "local_game_state"
    const val KEY_AUTH_TOKEN = "auth_token"
    const val KEY_ACTIVE_SESSION = "active_session"
    const val KEY_CURRENT_USER_EMAIL = "current_user_email"
    const val KEY_CURRENT_USER_NAME = "current_user_name"
    
    // Navigation Storage Keys
    const val KEY_NAV_IS_SINGLE_GAME_MODE = "isSingleGameMode"
    const val KEY_NAV_IS_WELCOME_SCREEN = "isWelcomeScreen"
    const val KEY_NAV_SELECTED_GAME_ID = "selectedGameId"
    const val KEY_NAV_SELECTED_LEAGUE_ID = "selectedLeagueId"
    const val KEY_NAV_SELECTED_SEASON_ID = "selectedSeasonId"
    const val KEY_NAV_SELECTED_TEAM_ID = "selectedTeamId"
    const val KEY_NAV_CURRENT_TAB = "currentTab"
    
    // Default config / values
    const val DEFAULT_FIRST_PITCH_TIME = "7:05 PM"
    const val DEFAULT_GAME_DATE = "2026-07-10"

    // HTML Tags
    object Tags {
        const val DIV = "div"
        const val SPAN = "span"
        const val BUTTON = "button"
        const val H2 = "h2"
        const val H3 = "h3"
        const val TABLE = "table"
        const val THEAD = "thead"
        const val TBODY = "tbody"
        const val TR = "tr"
        const val TH = "th"
        const val TD = "td"
        const val SELECT = "select"
        const val OPTION = "option"
        const val INPUT = "input"
        const val LABEL = "label"
    }

    // CSS Class Names
    object Classes {
        const val BTN = "btn"
        const val BTN_PRIMARY = "btn-primary"
        const val BTN_SECONDARY = "btn-secondary"
        const val BTN_DANGER = "btn-danger"
        const val BTN_ACTION = "btn-action"
        const val CARD = "card"
        const val FORM_CONTROL = "form-control"
        const val TAB_HEADERS = "tab-headers"
        const val TAB_HEADER = "tab-header"
        const val TAB_CONTAINER = "tab-container"
        const val TABLE_CONTAINER = "table-container"
    }

    // Baseball Positions
    object Positions {
        const val P = "P"
        const val C = "C"
        const val FIRST_BASE = "1B"
        const val SECOND_BASE = "2B"
        const val THIRD_BASE = "3B"
        const val SS = "SS"
        const val LF = "LF"
        const val CF = "CF"
        const val RF = "RF"
        const val DH = "DH"
    }
}
