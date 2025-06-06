import classNames from 'classnames';
import { LabelPairedPlusLgFillIcon } from '@deriv/quill-icons/LabelPaired';
import { Localize } from '@deriv-com/translations';
import Button from '../shared_ui/button';
import Text from '../shared_ui/text';
import FlyoutBlock from './flyout-block';

type TFlyoutBlockGroup = {
    onInfoClick: () => void;
    block_node: Element;
    is_active: boolean;
    should_hide_display_name: boolean;
};

const FlyoutBlockGroup = ({ onInfoClick, block_node, is_active, should_hide_display_name }: TFlyoutBlockGroup) => {
    const block_type = (block_node.getAttribute('type') || '') as string;
    const block_meta = window.Blockly.Blocks[block_type].meta();
    const is_variables_get = block_type === 'variables_get';
    const is_variables_set = block_type === 'variables_set';
    const { display_name, description } = block_meta;

    const AddButton = () => (
        <div className='flyout__item-buttons'>
            <Button
                id={`db-flyout__add--${block_type}`}
                data-testid={`dt_flyout__add_${block_type}`}
                className='flyout__button-add flyout__button-add--hide'
                has_effect
                is_plus
                onClick={() => {
                    if (block_type === 'trade_definition') {
                        const has_trade_definition = window.Blockly.derivWorkspace
                            .getAllBlocks()
                            .some(block => block.type === 'trade_definition');

                        if (has_trade_definition) {
                            window.Blockly.derivWorkspace.addBlockNode(null);
                            return;
                        }
                    }
                    window.Blockly.derivWorkspace.addBlockNode(block_node);
                }}
                type='button'
            >
                <LabelPairedPlusLgFillIcon height='24px' width='24px' fill='var(--text-general)' />
            </Button>
        </div>
    );

    return (
        <>
            {is_variables_set && <div className='flyout__hr' />}
            <div className={classNames('flyout__item', { 'flyout__item--active': is_active })}>
                {!should_hide_display_name && (
                    <>
                        <div className='flyout__item-header'>
                            <Text
                                size={is_variables_get ? 'xs' : 'xsm'}
                                lineHeight={is_variables_get ? undefined : 'xl'}
                                weight={is_variables_get ? undefined : 'bold'}
                            >
                                {display_name}
                            </Text>
                            {!is_variables_get && <AddButton />}
                        </div>
                        <div className='flyout__item-description'>
                            {description}
                            {onInfoClick && (
                                <a
                                    id={display_name.replace(/\s/gi, '-')}
                                    className='flyout__item-info'
                                    onClick={onInfoClick}
                                >
                                    <Localize i18n_default_text='Learn more' />
                                </a>
                            )}
                        </div>
                    </>
                )}
                <div className='flyout__block-workspace__header'>
                    <FlyoutBlock block_node={block_node} should_hide_display_name />
                    {is_variables_get && <AddButton />}
                </div>
            </div>
        </>
    );
};

export default FlyoutBlockGroup;
