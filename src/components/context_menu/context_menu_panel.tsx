/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, {
  cloneElement,
  Component,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react';
import classNames from 'classnames';
import { tabbable, FocusableElement } from 'tabbable';

import { CommonProps, NoArgCallback, keysOf } from '../common';
import { EuiIcon } from '../icon';
import { EuiResizeObserver } from '../observer/resize_observer';
import { cascadingMenuKeys } from '../../services';
import {
  EuiContextMenuItem,
  EuiContextMenuItemProps,
} from './context_menu_item';

export type EuiContextMenuPanelHeightChangeHandler = (height: number) => void;
export type EuiContextMenuPanelTransitionType = 'in' | 'out';
export type EuiContextMenuPanelTransitionDirection = 'next' | 'previous';
export type EuiContextMenuPanelShowPanelCallback = (
  currentPanelIndex?: number
) => void;

const titleSizeToClassNameMap = {
  s: 'euiContextMenuPanelTitle--small',
  m: null,
};

export const SIZES = keysOf(titleSizeToClassNameMap);

export interface EuiContextMenuPanelProps {
  initialFocusedItemIndex?: number;
  items?: ReactElement[];
  onClose?: NoArgCallback<void>;
  onHeightChange?: EuiContextMenuPanelHeightChangeHandler;
  onTransitionComplete?: NoArgCallback<void>;
  onUseKeyboardToNavigate?: NoArgCallback<void>;
  showNextPanel?: EuiContextMenuPanelShowPanelCallback;
  showPreviousPanel?: NoArgCallback<void>;
  title?: ReactNode;
  transitionDirection?: EuiContextMenuPanelTransitionDirection;
  transitionType?: EuiContextMenuPanelTransitionType;
  watchedItemProps?: string[];
  /**
   * Alters the size of the items and the title
   */
  size?: typeof SIZES[number];
}

type Props = CommonProps &
  Omit<
    HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'tabIndex' | 'onAnimationEnd' | 'title'
  > &
  EuiContextMenuPanelProps;

const transitionDirectionAndTypeToClassNameMap = {
  next: {
    in: 'euiContextMenuPanel-txInLeft',
    out: 'euiContextMenuPanel-txOutLeft',
  },
  previous: {
    in: 'euiContextMenuPanel-txInRight',
    out: 'euiContextMenuPanel-txOutRight',
  },
};

interface State {
  prevProps: {
    items: Props['items'];
  };
  menuItems: FocusableElement[];
  focusedItemIndex?: number;
  currentHeight?: number;
  height?: number;
}

export class EuiContextMenuPanel extends Component<Props, State> {
  static defaultProps: Partial<Props> = {
    items: [],
  };

  private _isMounted = false;
  private backButton?: HTMLElement | null = null;
  private panel?: HTMLElement | null = null;

  constructor(props: Props) {
    super(props);

    this.state = {
      prevProps: {
        items: this.props.items,
      },
      menuItems: [],
      focusedItemIndex:
        props.onClose && props.initialFocusedItemIndex != null
          ? props.initialFocusedItemIndex + 1 // Account for panel title back button
          : props.initialFocusedItemIndex,
      currentHeight: undefined,
    };
  }

  incrementFocusedItemIndex = (amount: number) => {
    let nextFocusedItemIndex;

    if (this.state.focusedItemIndex === undefined) {
      // If this is the beginning of the user's keyboard navigation of the menu, then we'll focus
      // either the first or last item.
      nextFocusedItemIndex = amount < 0 ? this.state.menuItems.length - 1 : 0;
    } else {
      nextFocusedItemIndex = this.state.focusedItemIndex + amount;

      if (nextFocusedItemIndex < 0) {
        nextFocusedItemIndex = this.state.menuItems.length - 1;
      } else if (nextFocusedItemIndex === this.state.menuItems.length) {
        nextFocusedItemIndex = 0;
      }
    }

    this.setState({
      focusedItemIndex: nextFocusedItemIndex,
    });
  };

  onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // If this panel contains items you can use the left arrow key to go back at any time.
    // But if it doesn't contain items, then you have to focus on the back button specifically,
    // since there could be content inside the panel which requires use of the left arrow key,
    // e.g. text inputs.
    const { items, onClose, showPreviousPanel } = this.props;

    if (
      onClose &&
      (items?.length ||
        document.activeElement === this.backButton ||
        document.activeElement === this.panel)
    ) {
      if (event.key === cascadingMenuKeys.ARROW_LEFT) {
        if (showPreviousPanel) {
          event.preventDefault();
          event.stopPropagation();
          showPreviousPanel();

          if (this.props.onUseKeyboardToNavigate) {
            this.props.onUseKeyboardToNavigate();
          }
        }
      }
    }

    if (items?.length) {
      switch (event.key) {
        case cascadingMenuKeys.TAB:
          requestAnimationFrame(() => {
            // NOTE: document.activeElement is stale if not wrapped in requestAnimationFrame
            const focusedItemIndex = this.state.menuItems.indexOf(
              document.activeElement as HTMLElement
            );

            // We need to sync our internal state with the user tabbing through items
            this.setState({
              focusedItemIndex:
                focusedItemIndex >= 0 &&
                focusedItemIndex < this.state.menuItems.length
                  ? focusedItemIndex
                  : undefined,
            });
          });
          break;

        case cascadingMenuKeys.ARROW_UP:
          event.preventDefault();
          this.incrementFocusedItemIndex(-1);

          if (this.props.onUseKeyboardToNavigate) {
            this.props.onUseKeyboardToNavigate();
          }
          break;

        case cascadingMenuKeys.ARROW_DOWN:
          event.preventDefault();
          this.incrementFocusedItemIndex(1);

          if (this.props.onUseKeyboardToNavigate) {
            this.props.onUseKeyboardToNavigate();
          }
          break;

        case cascadingMenuKeys.ARROW_RIGHT:
          if (this.props.showNextPanel) {
            event.preventDefault();
            this.props.showNextPanel(
              onClose && this.state.focusedItemIndex
                ? this.state.focusedItemIndex - 1 // Account for panel title back button
                : this.state.focusedItemIndex
            );

            if (this.props.onUseKeyboardToNavigate) {
              this.props.onUseKeyboardToNavigate();
            }
          }
          break;

        default:
          break;
      }
    }
  };

  updateFocus() {
    // Give positioning time to render before focus is applied. Otherwise page jumps.
    requestAnimationFrame(() => {
      if (!this._isMounted) {
        return;
      }

      // Setting focus while transitioning causes the animation to glitch, so we have to wait
      // until it's finished before we focus anything.
      if (this.props.transitionType) {
        // If the panel is transitioning, set focus to the panel so that users using
        // arrow keys that are fast clickers don't accidentally get stranded focus
        // or trigger keystrokes when it shouldn't
        this.panel?.focus({ preventScroll: true });
        return;
      }

      // If menuItems has been cleared, iterate through and set menuItems from tabbableItems
      if (!this.state.menuItems.length && this.panel) {
        const tabbableItems = tabbable(this.panel);
        if (tabbableItems.length) {
          this.setState({ menuItems: tabbableItems });
        }
      }

      if (this.state.menuItems.length) {
        // If an item is focused, focus it
        if (this.state.focusedItemIndex != null) {
          this.state.menuItems[this.state.focusedItemIndex].focus();
          return;
        }
        // Otherwise, if the back button panel title is present, focus it
        if (this.props.onClose) {
          this.setState({ focusedItemIndex: 0 });
          this.state.menuItems[0].focus();
          return;
        }
      }

      // Focus on the panel as a last resort.
      if (this.panel && !this.panel.contains(document.activeElement)) {
        this.panel.focus();
      }
    });
  }

  // If EuiContextMenu is used within an EuiPopover, EuiPopover's own
  // `updateFocus()` method hijacks EuiContextMenuPanel's `updateFocus()`
  // 350ms after the popover finishes transitioning in. This workaround
  // reclaims focus from parent EuiPopovers that do not set an `initialFocus`
  reclaimPopoverFocus() {
    if (!this.panel) return;

    const parent = this.panel.parentNode as HTMLElement;
    if (!parent) return;
    const hasEuiContextMenuParent = parent.classList.contains('euiContextMenu');

    // It's possible to use an EuiContextMenuPanel directly in a popover without
    // an EuiContextMenu, so we need to account for that when searching parent nodes
    const popoverParent = hasEuiContextMenuParent
      ? (parent?.parentNode?.parentNode as HTMLElement)
      : (parent?.parentNode as HTMLElement);
    if (!popoverParent) return;

    const hasPopoverParent = popoverParent.classList.contains(
      'euiPopover__panel'
    );
    if (!hasPopoverParent) return;

    // If the popover panel gains focus, switch it to the context menu panel instead
    popoverParent.addEventListener('focus', () => {
      this.updateFocus();
    });
  }

  onTransitionComplete = () => {
    if (this.props.onTransitionComplete) {
      this.props.onTransitionComplete();
    }
  };

  componentDidMount() {
    this.updateFocus();
    this.reclaimPopoverFocus();
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State
  ): Partial<State> | null {
    let needsUpdate = false;
    const nextState: Partial<State> = {};

    // Clear refs to menuItems if we're getting new ones.
    if (nextProps.items !== prevState.prevProps.items) {
      needsUpdate = true;
      nextState.menuItems = [];
      nextState.prevProps = { items: nextProps.items };
    }

    if (needsUpdate) {
      return nextState;
    }
    return null;
  }

  getWatchedPropsForItems(items: ReactElement[]) {
    // This lets us compare prevProps and nextProps among items so we can re-render if our items
    // have changed.
    const { watchedItemProps } = this.props;

    // Create fingerprint of all item's watched properties
    if (items.length && watchedItemProps && watchedItemProps.length) {
      return JSON.stringify(
        items.map((item) => {
          // Create object of item properties and values
          const props: any = {
            key: item.key,
          };
          watchedItemProps.forEach((prop: string) => {
            props[prop] = item.props[prop];
          });
          return props;
        })
      );
    }

    return null;
  }

  didItemsChange(prevItems: ReactElement[], nextItems: ReactElement[]) {
    // If the count of items has changed then update
    if (prevItems.length !== nextItems.length) {
      return true;
    }

    // Check if any watched item properties changed by quick string comparison
    if (
      this.getWatchedPropsForItems(nextItems) !==
      this.getWatchedPropsForItems(prevItems)
    ) {
      return true;
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    // Prevent calling `this.updateFocus()` below if we don't have to.
    if (nextProps.transitionType !== this.props.transitionType) {
      return true;
    }

    if (nextState.focusedItemIndex !== this.state.focusedItemIndex) {
      return true;
    }

    // **
    // this component should have either items or children,
    // if there are items we can determine via `watchedItemProps` if we should update
    // if there are children we can't know if they have changed so return true
    // **

    if (
      (this.props.items && this.props.items.length > 0) ||
      (nextProps.items && nextProps.items.length > 0)
    ) {
      if (this.didItemsChange(this.props.items!, nextProps.items!)) {
        return true;
      }
    }

    // it's not possible (in any good way) to know if `children` has changed, assume they might have
    if (this.props.children != null) {
      return true;
    }

    return false;
  }

  updateHeight() {
    const currentHeight = this.panel ? this.panel.clientHeight : 0;

    if (this.state.height !== currentHeight) {
      if (this.props.onHeightChange) {
        this.props.onHeightChange(currentHeight);

        this.setState({ height: currentHeight });
      }
    }
  }

  componentDidUpdate() {
    this.updateFocus();
  }

  panelRef = (node: HTMLElement | null) => {
    this.panel = node;

    this.updateHeight();
  };

  render() {
    const {
      children,
      className,
      onClose,
      title,
      onHeightChange,
      transitionType,
      transitionDirection,
      onTransitionComplete,
      onUseKeyboardToNavigate,
      items,
      watchedItemProps,
      initialFocusedItemIndex,
      showNextPanel,
      showPreviousPanel,
      size,
      ...rest
    } = this.props;
    let panelTitle;

    if (title) {
      const titleClasses = classNames(
        'euiContextMenuPanelTitle',
        size && titleSizeToClassNameMap[size]
      );

      if (Boolean(onClose)) {
        panelTitle = (
          <button
            className={titleClasses}
            type="button"
            onClick={onClose}
            ref={(node) => {
              this.backButton = node;
            }}
            data-test-subj="contextMenuPanelTitleButton"
          >
            <span className="euiContextMenu__itemLayout">
              <EuiIcon
                type="arrowLeft"
                size="m"
                className="euiContextMenu__icon"
              />

              <span className="euiContextMenu__text">{title}</span>
            </span>
          </button>
        );
      } else {
        panelTitle = (
          <div className={titleClasses}>
            <span className="euiContextMenu__itemLayout">{title}</span>
          </div>
        );
      }
    }

    const classes = classNames(
      'euiContextMenuPanel',
      className,
      transitionDirection &&
        transitionType &&
        transitionDirectionAndTypeToClassNameMap[transitionDirection]
        ? transitionDirectionAndTypeToClassNameMap[transitionDirection][
            transitionType
          ]
        : undefined
    );

    const content =
      items && items.length
        ? items.map((MenuItem) => {
            const cloneProps: Partial<EuiContextMenuItemProps> = {};
            if (size) {
              cloneProps.size = size;
            }
            return MenuItem.type === EuiContextMenuItem
              ? cloneElement(MenuItem, cloneProps)
              : MenuItem;
          })
        : children;

    return (
      <div
        ref={this.panelRef}
        className={classes}
        onKeyDown={this.onKeyDown}
        tabIndex={-1}
        onAnimationEnd={this.onTransitionComplete}
        {...rest}
      >
        {panelTitle}

        <EuiResizeObserver onResize={() => this.updateHeight()}>
          {(resizeRef) => <div ref={resizeRef}>{content}</div>}
        </EuiResizeObserver>
      </div>
    );
  }
}
